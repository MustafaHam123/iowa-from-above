import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type CachedGoogleAsset = {
  body: Buffer;
  contentType: string;
};

const cacheDir = path.join(process.cwd(), ".next", "google-api-cache");
const pendingAssets = new Map<string, Promise<CachedGoogleAsset>>();

function cacheFileForKey(key: string, extension: "body" | "json") {
  const hash = createHash("sha256").update(key).digest("hex");

  return path.join(cacheDir, `${hash}.${extension}`);
}

async function readCachedAsset(key: string) {
  try {
    const [body, metadata] = await Promise.all([
      readFile(cacheFileForKey(key, "body")),
      readFile(cacheFileForKey(key, "json"), "utf8"),
    ]);
    const parsed = JSON.parse(metadata) as { contentType?: unknown };

    return {
      body,
      contentType:
        typeof parsed.contentType === "string"
          ? parsed.contentType
          : "application/octet-stream",
    };
  } catch {
    return undefined;
  }
}

async function writeCachedAsset(key: string, asset: CachedGoogleAsset) {
  try {
    await mkdir(cacheDir, { recursive: true });
    await Promise.all([
      writeFile(cacheFileForKey(key, "body"), asset.body),
      writeFile(
        cacheFileForKey(key, "json"),
        JSON.stringify({ contentType: asset.contentType }),
      ),
    ]);
  } catch {
    // Cache writes should never break the map experience.
  }
}

export async function getCachedGoogleAsset(
  key: string,
  loadAsset: () => Promise<CachedGoogleAsset>,
) {
  const cachedAsset = await readCachedAsset(key);

  if (cachedAsset) {
    return { ...cachedAsset, cacheStatus: "HIT" };
  }

  let pendingAsset = pendingAssets.get(key);

  if (!pendingAsset) {
    pendingAsset = loadAsset().then(async (asset) => {
      await writeCachedAsset(key, asset);

      return asset;
    });
    pendingAssets.set(key, pendingAsset);
  }

  try {
    const asset = await pendingAsset;

    return { ...asset, cacheStatus: "MISS" };
  } finally {
    if (pendingAssets.get(key) === pendingAsset) {
      pendingAssets.delete(key);
    }
  }
}
