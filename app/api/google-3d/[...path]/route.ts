import { getCachedGoogleAsset } from "../../googleCache";

export const runtime = "nodejs";

const GOOGLE_3D_BASE_URL = "https://tile.googleapis.com/v1/3dtiles";
const GOOGLE_REQUEST_SPACING_MS = 1_000;
const DAILY_QUOTA_COOLDOWN_MS = 60_000;

let googleRequestGate = Promise.resolve();
let lastGoogleRequestStartedAt = 0;
let dailyQuotaBlockedUntil = 0;

async function waitForGoogleRequestSlot() {
  const previousRequest = googleRequestGate;
  let releaseRequest: () => void = () => undefined;

  googleRequestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  await previousRequest;

  const remainingDelay = Math.max(
    0,
    GOOGLE_REQUEST_SPACING_MS - (Date.now() - lastGoogleRequestStartedAt),
  );

  if (remainingDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  }

  lastGoogleRequestStartedAt = Date.now();
  releaseRequest();
}

const LOCAL_FLIGHT_BOUNDS = {
  north: 41.7,
  south: 41.48,
  west: -93.76,
  east: -93.46,
};

function proxyPathForGoogleUri(uri: string) {
  const absoluteUri = uri.startsWith("/")
    ? uri
    : `/v1/3dtiles/${uri.replace(/^\.?\//, "")}`;

  return `/api/google-3d${absoluteUri.replace(/^\/v1\/3dtiles/, "")}`;
}

function regionTouchesFlightArea(region: unknown) {
  if (!Array.isArray(region) || region.length < 4) {
    return true;
  }

  const west = CesiumRadiansToDegrees(Number(region[0]));
  const south = CesiumRadiansToDegrees(Number(region[1]));
  const east = CesiumRadiansToDegrees(Number(region[2]));
  const north = CesiumRadiansToDegrees(Number(region[3]));

  if (![west, south, east, north].every(Number.isFinite)) {
    return true;
  }

  return (
    east >= LOCAL_FLIGHT_BOUNDS.west &&
    west <= LOCAL_FLIGHT_BOUNDS.east &&
    north >= LOCAL_FLIGHT_BOUNDS.south &&
    south <= LOCAL_FLIGHT_BOUNDS.north
  );
}

function CesiumRadiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function boxTouchesFlightArea(box: unknown) {
  if (!Array.isArray(box) || box.length < 12) {
    return true;
  }

  const values = box.slice(0, 12).map(Number);

  if (!values.every(Number.isFinite)) {
    return true;
  }

  const [x, y, z] = values;
  const centerDistance = Math.hypot(x, y, z);
  const halfDiagonal = Math.hypot(...values.slice(3));

  if (centerDistance === 0 || halfDiagonal >= centerDistance) {
    return true;
  }

  const centerLongitude = CesiumRadiansToDegrees(Math.atan2(y, x));
  const centerLatitude = CesiumRadiansToDegrees(
    Math.atan2(z, Math.hypot(x, y)),
  );
  const angularRadius = CesiumRadiansToDegrees(
    Math.asin(Math.min(halfDiagonal / centerDistance, 1)),
  );

  return (
    centerLongitude + angularRadius >= LOCAL_FLIGHT_BOUNDS.west &&
    centerLongitude - angularRadius <= LOCAL_FLIGHT_BOUNDS.east &&
    centerLatitude + angularRadius >= LOCAL_FLIGHT_BOUNDS.south &&
    centerLatitude - angularRadius <= LOCAL_FLIGHT_BOUNDS.north
  );
}

function tileTouchesFlightArea(tile: Record<string, unknown>) {
  const boundingVolume = tile.boundingVolume as
    | { box?: unknown; region?: unknown }
    | undefined;

  if (boundingVolume?.region) {
    return regionTouchesFlightArea(boundingVolume.region);
  }

  if (boundingVolume?.box) {
    return boxTouchesFlightArea(boundingVolume.box);
  }

  return true;
}

function rewriteUri(uri: string) {
  if (uri.startsWith("/api/google-3d")) {
    return uri;
  }

  if (uri.startsWith("http")) {
    return uri;
  }

  return proxyPathForGoogleUri(uri);
}

function rewriteTilesetUris(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((child) => {
        if (!child || typeof child !== "object") {
          return true;
        }

        const record = child as Record<string, unknown>;

        return !("boundingVolume" in record) || tileTouchesFlightArea(record);
      })
      .map(rewriteTilesetUris);
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

  incomingUrl.searchParams.forEach((value, name) => {
    if (name !== "key") {
      googleUrl.searchParams.set(name, value);
      cacheSearchParams.set(name, value);
    }
  });

  const cacheKey = `google-3d:${path}?${cacheSearchParams.toString()}`;

  try {
    const asset = await getCachedGoogleAsset(cacheKey, async () => {
      const key = process.env.GOOGLE_MAP_TILES_API_KEY;

      if (!key) {
        throw new Error("GOOGLE_MAP_TILES_API_KEY is not configured");
      }

      if (Date.now() < dailyQuotaBlockedUntil) {
        throw new Error("Google 3D daily quota cooldown is active");
      }

      googleUrl.searchParams.set("key", key);

      let response: Response | undefined;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (Date.now() < dailyQuotaBlockedUntil) {
          throw new Error("Google 3D daily quota cooldown is active");
        }

        await waitForGoogleRequestSlot();
        response = await fetch(googleUrl, {
          cache: "no-store",
          headers: {
            Accept: request.headers.get("accept") ?? "*/*",
          },
        });

        if (response.status !== 429 || attempt === 3) {
          break;
        }

        const quotaDetails = await response.clone().text();

        if (quotaDetails.includes("requests per day")) {
          dailyQuotaBlockedUntil = Date.now() + DAILY_QUOTA_COOLDOWN_MS;
          break;
        }

        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        const retryDelayMs = Number.isFinite(retryAfterSeconds)
          ? Math.max(retryAfterSeconds * 1_000, 750)
          : 750 * 2 ** attempt;

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
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

      if (contentType.includes("json")) {
        const tileset = await response.json();
        const body = Buffer.from(JSON.stringify(rewriteTilesetUris(tileset)));

        return {
          body,
          contentType: "application/json",
        };
      }

      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: contentType || "application/octet-stream",
      };
    });

    const responseBody = asset.contentType.includes("json")
      ? Buffer.from(
          JSON.stringify(
            rewriteTilesetUris(JSON.parse(asset.body.toString("utf8"))),
          ),
        )
      : asset.body;

    return new Response(new Uint8Array(responseBody), {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=10800",
        "Content-Type": asset.contentType,
        "X-Google-Api-Cache": asset.cacheStatus,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Google 3D daily quota cooldown is active"
    ) {
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }

    console.error("Google 3D tile proxy failed", error);
    return new Response(null, { status: 502 });
  }
}
