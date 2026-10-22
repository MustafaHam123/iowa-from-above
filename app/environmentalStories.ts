export type EnvironmentalStory = {
  signal: string; people: string;
  responses: [{ label: string; mechanism: string }, { label: string; mechanism: string }];
};
// Documented place context and general response mechanisms; no simulated effects.
export const ENVIRONMENTAL_STORIES: Record<string, EnvironmentalStory> = {
  "water-works": {"signal": "Upstream reaches taps", "people": "Source-water quality affects treatment demands for the communities served by central Iowa utilities. River readings and treated drinking-water results answer different questions.", "responses": [{"label": "Protect source water", "mechanism": "Reduce nutrient losses upstream with appropriate conservation practices across the river basin."}, {"label": "Test and treat", "mechanism": "Utilities monitor and treat water before distribution. Use utility reports to assess treated drinking water."}]},
  "raccoon-monitor": {"signal": "Measure the river", "people": "This USGS station provides observations upstream of Des Moines. Its dated nitrate-plus-nitrite readings describe this monitoring location, not every field or household.", "responses": [{"label": "Compare observations", "mechanism": "Read the observation date, units and provisional status before interpreting a value."}, {"label": "Reduce nutrient losses", "mechanism": "Choose suitable soil, nutrient and drainage practices upstream; measurements alone do not identify the source."}]},
  "saylorville": {"signal": "Store floodwater upstream", "people": "The reservoir helps reduce flood risk for communities along the Des Moines River. Flood maps show mapped hazards, not reservoir operations or current flooding.", "responses": [{"label": "Manage reservoir storage", "mechanism": "USACE operates Saylorville to manage river flows within the project’s constraints."}, {"label": "Plan floodplain use", "mechanism": "Keep space for floodwater and combine planning with official warnings; the dam cannot remove all risk."}]},
  "chichaqua": {"signal": "Restore river habitats", "people": "Old Skunk River channels and wetlands provide habitat within Chichaqua. Polk County protects and restores these landscapes instead of treating them as unused ground.", "responses": [{"label": "Protect wetlands", "mechanism": "Retain habitat and water-storage functions. The watershed overlay does not measure wetland condition."}, {"label": "Restore oxbows", "mechanism": "Restore suitable former river channels with specialists. Results depend on hydrology and site design."}]},
  "neal-smith": {"signal": "Bring prairie back", "people": "The refuge reconstructs native prairie and other ecosystems after widespread habitat loss in Iowa. Native habitat supports wildlife and connects conservation with working landscapes.", "responses": [{"label": "Restore native habitat", "mechanism": "USFWS uses locally sourced native seeds and continuing management to reconstruct prairie communities."}, {"label": "Protect soil cover", "mechanism": "In suitable locations, perennial vegetation helps hold soil and slow runoff. This view does not quantify that effect."}]},
  "bear-creek": {"signal": "Protect stream edges", "people": "Bear Creek researchers study how buffers connect farmland with healthier streams. This is a published study-area location, not a claim about a specific field’s water quality.", "responses": [{"label": "Streamside buffers", "mechanism": "Trees, shrubs and native grass can intercept overland runoff and protect stream banks."}, {"label": "Treat drainage water", "mechanism": "Buried drainage can bypass ordinary buffers. Suitable saturated buffers or other drainage treatments address that pathway."}]},

  capitol: { signal: "Decisions travel downstream", people: "Upstream and downstream communities share water. A county boundary cannot contain runoff.", responses: [{ label: "Watershed planning", mechanism: "Coordinate land and water decisions across the whole drainage area." }, { label: "Fund monitoring", mechanism: "Observations help communities assess conditions and track changes over time." }] },
  "high-trestle": { signal: "Nutrients move downstream", people: "River communities share the effects of upstream nutrient losses. A station measures conditions, not who caused them.", responses: [{ label: "Cover crops", mechanism: "Growing plants can take up nitrogen that might otherwise be lost from soil." }, { label: "Treatment wetlands", mechanism: "Suitably designed wetlands can remove some nitrate from drainage water. Performance depends on the site." }] },
  ledges: { signal: "Give water room", people: "Creek crossings and low ground can put access and property in the path of floodwater. Mapped hazards are not current floods.", responses: [{ label: "Floodplain space", mechanism: "Protect floodplain functions that store and convey floodwater." }, { label: "Use warnings", mechanism: "Use official alerts for current conditions; never infer a safe crossing from this map." }] },
  hoover: { signal: "Restore creek function", people: "Flood management at Hoover Creek connects a historic site with the surrounding community.", responses: [{ label: "Creek restoration", mechanism: "NPS assessed restoration and stabilization of Hoover Creek for flood mitigation." }, { label: "Floodplain planning", mechanism: "Consider where water can spread while protecting people and historic resources." }] },
  "pikes-peak": { signal: "Iowa connects downstream", people: "The Mississippi links Iowa's tributaries with distant communities and ecosystems. Nutrient management has consequences beyond Iowa.", responses: [{ label: "Reduce nutrient losses", mechanism: "Combine suitable conservation practices across the upstream watershed." }, { label: "Coordinate upstream", mechanism: "Work across jurisdictions rather than treating only the river's final outlet." }] },
  "loess-hills": { signal: "Roots protect slopes", people: "Protecting vegetation on steep Loess Hills slopes supports habitat, soil retention and water quality.", responses: [{ label: "Protect native cover", mechanism: "Maintain vegetation that helps hold soil and supports native communities." }, { label: "Habitat restoration", mechanism: "Support land managers restoring prairie and woodland systems at suitable sites." }] },
};

export function distanceKm(a: {lat: number; lng: number}, b: {lat: number; lng: number}) {
  const rad = Math.PI / 180;
  const dLat = (b.lat-a.lat)*rad, dLng = (b.lng-a.lng)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
}

function inRing(point: number[], ring: number[][]) {
  let inside = false;
  for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if ((yi>point[1]) !== (yj>point[1]) && point[0] < (xj-xi)*(point[1]-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export function containsLocation(geometry: {type: string; coordinates: unknown}, lat: number, lng: number) {
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return polygons.some((rings) => rings.length && inRing([lng,lat], rings[0]) && !rings.slice(1).some((ring) => inRing([lng,lat],ring)));
}
