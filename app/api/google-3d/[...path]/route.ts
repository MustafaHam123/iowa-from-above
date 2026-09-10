import { getCachedGoogleAsset } from "../../googleCache";
import {
  addGoogleVisitorCookie,
  consumeGoogleRequestQuota,
  getGoogleVisitor,
  getNextGoogleDayBoundary,
  GoogleQuotaLimitError,
  quotaResponseHeaders,
} from "../../googleQuota";

export const runtime = "nodejs";

const GOOGLE_3D_BASE_URL = "https://tile.googleapis.com/v1/3dtiles";
// Let a useful batch of visible tiles load together without opening an
// unbounded connection flood. Cesium also applies its own client-side limit.
const GOOGLE_MAX_CONCURRENT_REQUESTS = 8;
const GOOGLE_3D_ROOT_CACHE_SECONDS = 3 * 60 * 60;
const GOOGLE_3D_RENDER_CACHE_SECONDS = 30 * 24 * 60 * 60;

const googleRequestWaiters: Array<() => void> = [];
let googleRequestsInFlight = 0;
let googleRateLimitBlockedUntil = 0;
let googleDailyLimitReached = false;

class GoogleUpstreamRateLimitError extends GoogleQuotaLimitError {
  constructor(retryAt: Date) {
    super("google", retryAt);
    this.name = "GoogleUpstreamRateLimitError";
  }
}

function googleRetryBoundary(response: Response, details: string) {
  if (/requests per day|dailyLimitExceeded|daily quota/i.test(details)) {
    return getNextGoogleDayBoundary();
  }

  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  const cooldownSeconds = Number.isFinite(retryAfterSeconds)
    ? Math.min(60, Math.max(5, retryAfterSeconds))
    : 30;

  return new Date(Date.now() + cooldownSeconds * 1_000);
}

async function waitForGoogleRateLimitCooldown() {
  const remainingDelay = googleRateLimitBlockedUntil - Date.now();

  if (remainingDelay <= 0) {
    return;
  }

  if (googleDailyLimitReached) {
    throw new GoogleUpstreamRateLimitError(
      new Date(googleRateLimitBlockedUntil),
    );
  }

  await new Promise((resolve) => setTimeout(resolve, remainingDelay));
}

async function withGoogleRequestSlot<T>(task: () => Promise<T>) {
  if (googleRequestsInFlight >= GOOGLE_MAX_CONCURRENT_REQUESTS) {
    await new Promise<void>((resolve) => {
      googleRequestWaiters.push(resolve);
    });
  } else {
    googleRequestsInFlight += 1;
  }

  try {
    return await task();
  } finally {
    const nextRequest = googleRequestWaiters.shift();

    if (nextRequest) {
      // Transfer this occupied slot directly to the oldest waiter. Keeping the
      // count unchanged prevents a newly arriving request from cutting in.
      nextRequest();
    } else {
      googleRequestsInFlight -= 1;
    }
  }
}

function proxyPathForGoogleUri(uri: string) {
  const absoluteUri = uri.startsWith("/")
    ? uri
    : `/v1/3dtiles/${uri.replace(/^\.?\//, "")}`;

  return `/api/google-3d${absoluteUri.replace(/^\/v1\/3dtiles/, "")}`;
}

function rewriteUri(uri: string) {
  if (uri.startsWith("/api/google-3d")) {
    return uri;
  }

  if (uri.startsWith("http")) {
    try {
      const absoluteUrl = new URL(uri);

      if (
        absoluteUrl.hostname === "tile.googleapis.com" &&
        absoluteUrl.pathname.startsWith("/v1/3dtiles/")
      ) {
        return `/api/google-3d${absoluteUrl.pathname.replace(
          /^\/v1\/3dtiles/,
          "",
        )}${absoluteUrl.search}`;
      }
    } catch {
      return uri;
    }

    return uri;
  }

  return proxyPathForGoogleUri(uri);
}

function rewriteTilesetUris(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(rewriteTilesetUris);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const rewritten: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(record)) {
    if ((key === "uri" || key === "url") && typeof child === "string") {
      rewritten[key] = rewriteUri(child);
    } else {
      rewritten[key] = rewriteTilesetUris(child);
    }
  }

  return rewritten;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  const path = params.path.map(encodeURIComponent).join("/");
  const incomingUrl = new URL(request.url);
  const googleUrl = new URL(`${GOOGLE_3D_BASE_URL}/${path}`);
  const cacheSearchParams = new URLSearchParams();
  const sessionCacheSearchParams = new URLSearchParams();
  // Local-only versioning lets us deliberately refresh the three-hour root
  // session after a Google quota/configuration change. Never send it upstream.
  const rootCacheVersion = incomingUrl.searchParams.get("appSession") ?? "default";

  incomingUrl.searchParams.forEach((value, name) => {
    if (name !== "key" && name !== "appSession") {
      googleUrl.searchParams.set(name, value);
      sessionCacheSearchParams.set(name, value);

      if (name !== "session") {
        cacheSearchParams.set(name, value);
      }
    }
  });
  cacheSearchParams.sort();
  sessionCacheSearchParams.sort();

  const requestKind = path === "root.json" ? "root" : "render";
  const visitor = getGoogleVisitor(request);
  const cacheKey =
    requestKind === "root"
      ? `google-3d:root-session:visitor=${visitor.id}:version=${rootCacheVersion}`
      : `google-3d:${path}?${cacheSearchParams.toString()}`;
  const fallbackCacheKeys =
    requestKind === "render"
      ? [`google-3d:${path}?${sessionCacheSearchParams.toString()}:accept=${
          request.headers.get("accept") ?? "*/*"
        }`]
      : [];

  try {
    const asset = await getCachedGoogleAsset(
      cacheKey,
      async () => {
        const key = process.env.GOOGLE_MAP_TILES_API_KEY;

        if (!key) {
          throw new Error("GOOGLE_MAP_TILES_API_KEY is not configured");
        }

        googleUrl.searchParams.set("key", key);

        let response: Response | undefined;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          await waitForGoogleRateLimitCooldown();
          response = await withGoogleRequestSlot(async () => {
            // Recheck after waiting for a slot because another request may have
            // received a 429 while this request was queued.
            await waitForGoogleRateLimitCooldown();
            await consumeGoogleRequestQuota(requestKind, visitor.id);

            return fetch(googleUrl, {
              cache: "no-store",
              headers: {
                Accept: request.headers.get("accept") ?? "*/*",
              },
            });
          });

          if (response.status !== 429) {
            break;
          }

          const errorDetails = (await response.text()).slice(0, 800);
          const retryAt = googleRetryBoundary(response, errorDetails);
          googleDailyLimitReached =
            /requests per day|dailyLimitExceeded|daily quota/i.test(
              errorDetails,
            );
          googleRateLimitBlockedUntil = retryAt.getTime();

          if (googleDailyLimitReached || attempt === 1) {
            throw new GoogleUpstreamRateLimitError(retryAt);
          }
        }

        if (!response) {
          throw new Error("Google 3D tile request did not return a response");
        }

        if (!response.ok) {
          const errorDetails = (await response.text()).slice(0, 800);
          throw new Error(
            `Google 3D tile request failed: ${response.status} ${errorDetails}`,
          );
        }

        const contentType = response.headers.get("content-type") ?? "";
        const cacheSeconds =
          requestKind === "root"
            ? GOOGLE_3D_ROOT_CACHE_SECONDS
            : GOOGLE_3D_RENDER_CACHE_SECONDS;
        // Approved student-project exception: root sessions remain scoped to
        // three hours, while exact render assets can be reused for 30 days.
        // The render cache key intentionally excludes Google's session token.
        const cachePolicy = {
          cacheControl: `private, max-age=${cacheSeconds}, immutable`,
          expiresAt: Date.now() + cacheSeconds * 1_000,
        };

        if (contentType.includes("json")) {
          const tileset = await response.json();
          const body = Buffer.from(JSON.stringify(rewriteTilesetUris(tileset)));

          return {
            body,
            ...cachePolicy,
            contentType: "application/json",
          };
        }

        return {
          body: Buffer.from(await response.arrayBuffer()),
          ...cachePolicy,
          contentType: contentType || "application/octet-stream",
        };
      },
      true,
      fallbackCacheKeys,
    );

    const responseBody = asset.contentType.includes("json")
      ? Buffer.from(
          JSON.stringify(
            rewriteTilesetUris(JSON.parse(asset.body.toString("utf8"))),
          ),
        )
      : asset.body;

    const headers = addGoogleVisitorCookie(new Headers({
      "Cache-Control": asset.cacheControl ?? "no-store",
      "Content-Type": asset.contentType,
      "X-Google-Api-Cache": asset.cacheStatus,
    }), request, visitor);

    return new Response(new Uint8Array(responseBody), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof GoogleUpstreamRateLimitError) {
      const headers = quotaResponseHeaders(error);
      headers.set("X-Iowa-Google-Rate-Limited", "true");

      return new Response(
        JSON.stringify({
          error: "RATE_LIMIT_REACHED",
          resetsAt: error.resetsAt.toISOString(),
          scope: error.scope,
        }),
        {
          status: 429,
          headers: addGoogleVisitorCookie(headers, request, visitor),
        },
      );
    }

    if (error instanceof GoogleQuotaLimitError) {
      const quotaError =
        error.scope === "visitor-daily"
          ? "VISITOR_DAILY_LIMIT_REACHED"
          : "MONTHLY_LIMIT_REACHED";

      return new Response(
        JSON.stringify({
          error: quotaError,
          resetsAt: error.resetsAt.toISOString(),
          scope: error.scope,
        }),
        {
          status: 403,
          headers: addGoogleVisitorCookie(
            quotaResponseHeaders(error),
            request,
            visitor,
          ),
        },
      );
    }

    console.error("Google 3D tile proxy failed", error);
    return new Response(null, { status: 502 });
  }
}
