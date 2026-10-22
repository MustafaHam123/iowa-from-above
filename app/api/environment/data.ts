import type { EnvironmentalData, EnvironmentalFeature, EnvironmentalLayer } from "../../environment";

const USGS = "https://api.waterdata.usgs.gov/ogcapi/v1/collections";
const WBD = "https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/4";
const FEMA = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28";
async function fetchOfficialJSON(url: string) {
  // ArcGIS can return HTTP 200 with an error object. Cache only after checking
  // the payload, so a transient service failure never becomes a day-long outage.
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error("The official data service is unavailable.");
  const payload = await response.json();
  if (payload.error || payload.code) throw new Error("The official data service could not complete this query.");
  return payload;
}
const officialQueries = new Map<string, { expires: number; result: ReturnType<typeof fetchOfficialJSON> }>();
export function clearEnvironmentalCache() { officialQueries.clear(); }
async function read(url: string, seconds = 900) {
  const cached = officialQueries.get(url);
  if (cached && cached.expires > Date.now()) return cached.result;
  const entry = { expires: Infinity, result: fetchOfficialJSON(url) };
  officialQueries.set(url, entry);
  if (officialQueries.size > 128) officialQueries.delete(officialQueries.keys().next().value!);
  try {
    const payload = await entry.result;
    entry.expires = Date.now() + seconds * 1000;
    return payload;
  } catch (error) {
    if (officialQueries.get(url) === entry) officialQueries.delete(url);
    throw error;
  }
}

export async function getEnvironmentalData(layer: EnvironmentalLayer, lat: number, lng: number): Promise<EnvironmentalData> {
  let features: EnvironmentalFeature[] = [];
  let partial = false;
  if (layer === "water") {
    // Only parameter 99133: nitrate PLUS nitrite, in situ, mg/L as nitrogen.
    // Never mix nitrate-as-N with nitrate-as-NO3 or interpolate between stations.
    const payload = await read(`${USGS}/latest-continuous/items?${new URLSearchParams({ f: "json", limit: "1000", parameter_code: "99133", bbox: "-96.64,40.37,-90.14,43.51" })}`);
    partial = payload.links?.some((link: { rel: string }) => link.rel === "next") ?? false;
    const latest = new Map<string, typeof payload.features[number]>();
    for (const feature of payload.features ?? []) {
      const p = feature.properties;
      const current = latest.get(p.monitoring_location_id);
      if (!current || Date.parse(p.time) > Date.parse(current.properties.time)) latest.set(p.monitoring_location_id, feature);
    }
    const results = await Promise.allSettled([...latest].map(async ([id, feature]) => {
      const site = await read(`${USGS}/monitoring-locations/items/${encodeURIComponent(id)}?f=json`, 86400);
      if (site.properties.state_code !== "19") return null;
      const p = feature.properties;
      const numeric = p.value == null || String(p.value).trim() === "" ? NaN : Number(p.value);
      const value = Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
      return {
        type: "Feature", id, geometry: feature.geometry,
        properties: {
          layer, name: site.properties.monitoring_location_name, source: "USGS · parameter 99133",
          sourceUrl: `https://waterdata.usgs.gov/monitoring-location/${id}/`,
          summary: "Nitrate plus nitrite measured in the river, in situ, as nitrogen. This observation does not establish its cause or the safety of drinking water.",
          value, unit: p.unit_of_measure, observed: p.time, approval: p.approval_status,
          qualifier: Array.isArray(p.qualifier) ? p.qualifier.join(", ") : p.qualifier || "",
        },
      } as EnvironmentalFeature;
    }));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) features.push(result.value);
      if (result.status === "rejected") partial = true;
    }
  } else {
    const base = layer === "watershed" ? WBD : FEMA;
    const radius = layer === "watershed" ? 0.12 : 0.045;
    const params = new URLSearchParams({
      f: "geojson", where: layer === "watershed" ? "states LIKE '%IA%'" : "(SFHA_TF = 'T' OR ZONE_SUBTY LIKE '0.2 PCT%')",
      geometry: `${lng-radius},${lat-radius},${lng+radius},${lat+radius}`,
      geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326",
      spatialRel: "esriSpatialRelIntersects", returnGeometry: "true",
      outFields: layer === "watershed" ? "objectid,name,huc8" : "OBJECTID,FLD_ZONE,ZONE_SUBTY,SFHA_TF",
      maxAllowableOffset: "0.00015", resultRecordCount: "100",
    });
    const payload = await read(`${base}/query?${params}`, 86400);
    if (!Array.isArray(payload.features)) throw new Error("The geographic service returned an invalid response.");
    partial = !!payload.exceededTransferLimit || payload.features.length >= 100;
    features = payload.features.map((feature: { id?: string; geometry: EnvironmentalFeature["geometry"]; properties: Record<string, string> }) => {
      const p = feature.properties;
      const zone = p.FLD_ZONE;
      const summary = layer === "watershed"
        ? "A USGS subbasin groups land draining toward a common outlet. Runoff and subsurface drainage can carry nutrients downstream. Boundaries do not measure pollution or identify responsible farms."
        : p.SFHA_TF === "T"
          ? "FEMA special flood hazard area: at least a 1% annual chance flood hazard. This describes mapped probability, not current flooding or a once-per-century schedule."
          : "See the FEMA zone and subtype for this mapped area. Zone X can include moderate or minimal mapped hazards; unshaded areas and unmapped land can still flood. This is not a forecast.";
      return {
        type: "Feature", id: String(p.objectid ?? p.OBJECTID ?? feature.id), geometry: feature.geometry,
        properties: { layer, name: layer === "watershed" ? p.name : `Flood zone ${zone}`,
          source: layer === "watershed" ? "USGS · Watershed Boundary Dataset" : "FEMA · National Flood Hazard Layer",
          sourceUrl: base, summary, classification: layer === "watershed" ? `HUC8 ${p.huc8}` : `${zone}${p.ZONE_SUBTY ? ` · ${p.ZONE_SUBTY}` : ""}` },
      };
    });
  }
  return { type: "FeatureCollection", features, partial, fetchedAt: new Date().toISOString() };
}
