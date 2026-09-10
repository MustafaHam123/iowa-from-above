import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CachedGoogleAsset = {
  body: Buffer;
  cacheControl?: string;
  contentType: string;
  expiresAt?: number;
};

const cacheDir =
  process.env.GOOGLE_API_CACHE_DIR ??
  path.join(process.cwd(), ".data", "google-api-cache");
const pendingAssets = new Map<string, Promise<CachedGoogleAsset>>();
const memoryAssets = new Map<string, CachedGoogleAsset>();
const MEMORY_CACHE_MAX_BYTES = 32 * 1024 * 1024;
let memoryCacheBytes = 0;

function rememberAsset(key: string, asset: CachedGoogleAsset) {
  if (asset.body.byteLength > MEMORY_CACHE_MAX_BYTES) {
    return;
  }

  const previousAsset = memoryAssets.get(key);

  if (previousAsset) {
    memoryCacheBytes -= previousAsset.body.byteLength;
    memoryAssets.delete(key);
  }

  memoryAssets.set(key, asset);
  memoryCacheBytes += asset.body.byteLength;

  while (memoryCacheBytes > MEMORY_CACHE_MAX_BYTES && memoryAssets.size > 1) {
    const oldestKey = memoryAssets.keys().next().value as string | undefined;

    if (!oldestKey) {
      break;
    }

    const oldestAsset = memoryAssets.get(oldestKey);
    memoryAssets.delete(oldestKey);
    memoryCacheBytes -= oldestAsset?.body.byteLength ?? 0;
  }
}

export function getGoogleResponseCachePolicy(response: Response) {
  const cacheControl = response.headers.get("cache-control") ?? undefined;
  const sharedMaxAgeMatch = cacheControl?.match(
    /(?:^|,)\s*s-maxage\s*=\s*"?(\d+)"?/i,
  );
  const browserMaxAgeMatch = cacheControl?.match(
    /(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/i,
  );
  const maxAgeSeconds = Number(
    sharedMaxAgeMatch?.[1] ?? browserMaxAgeMatch?.[1] ?? 0,
  );
  const responseAgeSeconds = Number(response.headers.get("age") ?? 0);
  const remainingMaxAgeSeconds = Math.max(
    0,
    maxAgeSeconds -
      (Number.isFinite(responseAgeSeconds) ? responseAgeSeconds : 0),
  );
  const expiresHeader = response.headers.get("expires");
  const expiresHeaderTime = expiresHeader ? Date.parse(expiresHeader) : NaN;
  const canStore = !/(?:^|,)\s*(?:no-cache|no-store|private)(?:\s|,|$)/i.test(
    cacheControl ?? "",
  );
  const expiresAt = canStore
    ? remainingMaxAgeSeconds > 0
      ? Date.now() + remainingMaxAgeSeconds * 1_000
      : Number.isFinite(expiresHeaderTime) && expiresHeaderTime > Date.now()
        ? expiresHeaderTime
        : undefined
    : undefined;

  return {
    cacheControl: cacheControl ?? "no-store",
    expiresAt,
  };
}

function cacheFileForKey(key: string, extension: "body" | "json") {
  const hash = createHash("sha256").update(key).digest("hex");

  return path.join(cacheDir, `${hash}.${extension}`);
}

function isFresh(asset: CachedGoogleAsset) {
  return (
    typeof asset.expiresAt === "number" && asset.expiresAt > Date.now()
  );
}

async function readCachedAsset(key: string) {
  const memoryAsset = memoryAssets.get(key);

  if (memoryAsset) {
    // Refresh insertion order so recently revisited tiles remain in memory.
    memoryAssets.delete(key);
    memoryAssets.set(key, memoryAsset);
    return memoryAsset;
  }

  try {
    const [body, metadata] = await Promise.all([
      readFile(cacheFileForKey(key, "body")),
      readFile(cacheFileForKey(key, "json"), "utf8"),
    ]);
    const parsed = JSON.parse(metadata) as {
      cacheControl?: unknown;
      contentType?: unknown;
      expiresAt?: unknown;
    };

    const asset = {
      body,
      cacheControl:
        typeof parsed.cacheControl === "string"
          ? parsed.cacheControl
          : undefined,
      contentType:
        typeof parsed.contentType === "string"
          ? parsed.contentType
          : "application/octet-stream",
      expiresAt:
        typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
    };

    rememberAsset(key, asset);
    return asset;
  } catch {
    return undefined;
  }
}

async function writeCachedAsset(key: string, asset: CachedGoogleAsset) {
  rememberAsset(key, asset);

  try {
    await mkdir(cacheDir, { recursive: true });
    await Promise.all([
      writeFile(cacheFileForKey(key, "body"), asset.body),
      writeFile(
        cacheFileForKey(key, "json"),
        JSON.stringify({
          cacheControl: asset.cacheControl,
          contentType: asset.contentType,
          expiresAt: asset.expiresAt,
        }),
      ),
    ]);
  } catch {
    // Cache writes should never break the map experience.
  }
}

export async function getCachedGoogleAsset(
  key: string,
  loadAsset: () => Promise<CachedGoogleAsset>,
  allowStaleOnError = true,
  fallbackKeys: string[] = [],
) {
  const cachedAsset = await readCachedAsset(key);

  if (cachedAsset && isFresh(cachedAsset)) {
    return { ...cachedAsset, cacheStatus: "HIT" };
  }

  let staleAsset = allowStaleOnError ? cachedAsset : undefined;

  for (const fallbackKey of fallbackKeys) {
    const fallbackAsset = await readCachedAsset(fallbackKey);

    if (fallbackAsset && isFresh(fallbackAsset)) {
      rememberAsset(key, fallbackAsset);
      void writeCachedAsset(key, fallbackAsset);
      return { ...fallbackAsset, cacheStatus: "HIT" };
    }

    if (allowStaleOnError && !staleAsset && fallbackAsset) {
      staleAsset = fallbackAsset;
    }
  }

  let pendingAsset = pendingAssets.get(key);

  if (!pendingAsset) {
    pendingAsset = loadAsset().then(async (asset) => {
      if (asset.expiresAt && asset.expiresAt > Date.now()) {
        // Memory makes an immediately repeated request a hit while the durable
        // disk write completes, so the first visible tile is not held back by
        // filesystem latency.
        rememberAsset(key, asset);
        void writeCachedAsset(key, asset);
      }

      return asset;
    });
    pendingAssets.set(key, pendingAsset);
  }

  try {
    let asset: CachedGoogleAsset;

    try {
      asset = await pendingAsset;
    } catch (error) {
      if (staleAsset) {
        return { ...staleAsset, cacheStatus: "STALE" };
      }

      throw error;
    }

    return { ...asset, cacheStatus: "MISS" };
  } finally {
    if (pendingAssets.get(key) === pendingAsset) {
      pendingAssets.delete(key);
    }
  }
}
