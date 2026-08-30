import { getCachedGoogleAsset } from "../../../../googleCache";

export const runtime = "nodejs";

const TILE_SIZE = 256;
const MAX_ZOOM = 21;

const IOWA_BOUNDS = {
  north: 43.5012,
  south: 40.3755,
  west: -96.6397,
  east: -90.1401,
};

let cachedSession:
  | {
      value: string;
      expiryMs: number;
    }
  | undefined;

function scaleForZoom(zoom: number) {
  return TILE_SIZE * 2 ** zoom;
}

function xToLng(x: number, zoom: number) {
  return (x / scaleForZoom(zoom)) * 360 - 180;
}

function yToLat(y: number, zoom: number) {
  const mercator = Math.PI * (1 - (2 * y) / scaleForZoom(zoom));
  return (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
}

function tileTouchesIowa(z: number, x: number, y: number) {
  const west = xToLng(x * TILE_SIZE, z);
  const east = xToLng((x + 1) * TILE_SIZE, z);
  const north = yToLat(y * TILE_SIZE, z);
  const south = yToLat((y + 1) * TILE_SIZE, z);

  return (
    east >= IOWA_BOUNDS.west &&
    west <= IOWA_BOUNDS.east &&
    north >= IOWA_BOUNDS.south &&
    south <= IOWA_BOUNDS.north
  );
}

async function getGoogleSession() {
  const key = process.env.GOOGLE_MAP_TILES_API_KEY;

  if (!key) {
    throw new Error("GOOGLE_MAP_TILES_API_KEY is not configured");
  }

  if (cachedSession && cachedSession.expiryMs - Date.now() > 60_000) {
    return cachedSession.value;
  }

  const response = await fetch(
    `https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mapType: "satellite",
        language: "en-US",
        region: "US",
        scale: "scaleFactor1x",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google tile session failed: ${response.status}`);
  }

  const data = (await response.json()) as { session: string; expiry?: string };
  const expirySeconds = Number(data.expiry);

  cachedSession = {
    value: data.session,
    expiryMs: Number.isFinite(expirySeconds)
      ? expirySeconds * 1000
      : Date.now() + 60 * 60 * 1000,
  };

  return cachedSession.value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const params = await context.params;
  const z = Number(params.z);
  const x = Number(params.x);
  const y = Number(params.y);
  const maxTile = 2 ** z;

  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    z > MAX_ZOOM ||
    x < 0 ||
    y < 0 ||
    x >= maxTile ||
    y >= maxTile ||
    !tileTouchesIowa(z, x, y)
  ) {
    return new Response(null, { status: 404 });
  }

  try {
    const asset = await getCachedGoogleAsset(
      `google-2d:${z}/${x}/${y}`,
      async () => {
        const key = process.env.GOOGLE_MAP_TILES_API_KEY;
        const session = await getGoogleSession();
        const response = await fetch(
          `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(
            session,
          )}&key=${encodeURIComponent(key ?? "")}`,
          {
            headers: {
              Accept: "image/*",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Google map tile request failed: ${response.status}`);
        }

        return {
          body: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get("content-type") ?? "image/png",
        };
      },
    );

    return new Response(new Uint8Array(asset.body), {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": asset.contentType,
        "X-Google-Api-Cache": asset.cacheStatus,
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
