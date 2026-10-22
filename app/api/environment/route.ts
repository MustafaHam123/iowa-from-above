import { getEnvironmentalData } from "./data";
import type { EnvironmentalLayer } from "../../environment";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const layer = params.get("layer");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!["water", "watershed", "flood"].includes(layer || "") || !params.has("lat") || !params.has("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 40.37 || lat > 43.51 || lng < -96.64 || lng > -90.14) {
    return Response.json({ error: "Choose an Iowa location and a valid environmental layer." }, { status: 400 });
  }
  try {
    return Response.json(await getEnvironmentalData(layer as EnvironmentalLayer, lat, lng));
  } catch (error) {
    console.warn("Environmental query failed:", error instanceof Error ? error.message : "Unknown upstream error");
    return Response.json({ error: "Official data is temporarily unavailable. Try again; no substitute data is shown." }, { status: 502 });
  }
}
