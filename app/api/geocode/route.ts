import { getCachedGoogleAsset } from "../googleCache";

export const runtime = "nodejs";

type CensusAddressMatch = {
  addressComponents?: {
    state?: string;
  };
  coordinates?: {
    x?: number;
    y?: number;
  };
  matchedAddress?: string;
};

type CensusGeocodeResponse = {
  result?: {
    addressMatches?: CensusAddressMatch[];
  };
};

function isIowaMatch(match: CensusAddressMatch) {
  const lat = match.coordinates?.y;
  const lng = match.coordinates?.x;

  return (
    match.addressComponents?.state === "IA" &&
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= 40.3755 &&
    lat <= 43.5012 &&
    lng >= -96.6397 &&
    lng <= -90.1401
  );
}

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();

  if (!address || address.length < 3 || address.length > 100) {
    return Response.json(
      { error: "Enter a valid Iowa address." },
      { status: 400 },
    );
  }

  const normalizedAddress = address.toLowerCase().replace(/\s+/g, " ");

  try {
    const asset = await getCachedGoogleAsset(
      `census-geocode-iowa:${normalizedAddress}`,
      async () => {
        const searchParams = new URLSearchParams({
          address,
          benchmark: "Public_AR_Current",
          format: "json",
        });
        const response = await fetch(
          `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${searchParams}`,
        );

        if (!response.ok) {
          throw new Error(`Address lookup failed with ${response.status}`);
        }

        const data = (await response.json()) as CensusGeocodeResponse;
        const result = data.result?.addressMatches?.find(isIowaMatch);
        const lat = result?.coordinates?.y;
        const lng = result?.coordinates?.x;

        if (typeof lat !== "number" || typeof lng !== "number") {
          throw new Error("No Iowa address was found.");
        }

        return {
          body: Buffer.from(
            JSON.stringify({
              address: result?.matchedAddress ?? address,
              lat,
              lng,
            }),
          ),
          contentType: "application/json; charset=utf-8",
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1_000,
        };
      },
    );

    return new Response(new Uint8Array(asset.body), {
      headers: {
        "Cache-Control": "private, max-age=2592000",
        "Content-Type": asset.contentType,
        "X-Address-Cache": asset.cacheStatus,
      },
    });
  } catch {
    return Response.json(
      { error: "That address could not be found in Iowa." },
      { status: 404 },
    );
  }
}
