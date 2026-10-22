export type EnvironmentalLayer = "water" | "watershed" | "flood";
export type EnvironmentalFeature = {
  type: "Feature";
  id: string;
  geometry: { type: string; coordinates: unknown };
  properties: {
    name: string; layer: EnvironmentalLayer; source: string; sourceUrl: string;
    summary: string; value?: number | null; unit?: string; observed?: string;
    approval?: string; qualifier?: string; classification?: string;
  };
};
export type EnvironmentalData = {
  type: "FeatureCollection"; features: EnvironmentalFeature[]; fetchedAt: string;
  partial: boolean;
};
export const ENVIRONMENT_TOPICS = {
  water: {
    title: "Water quality", subtitle: "USGS nutrient monitoring", color: "#f2bd67",
    explanation: "Excess nitrogen and phosphorus can harm waterways. River measurements help us understand source water, but do not tell us the quality of treated tap water.",
    question: "What does this nutrient measurement tell us, and what can't it tell us?",
  },
  watershed: {
    title: "Watersheds & runoff", subtitle: "USGS drainage boundaries", color: "#87d7b5",
    explanation: "Water connects farms, towns and downstream communities. Fertilizer and manure can contribute nutrients through runoff and drainage; a watershed boundary does not identify individual pollution sources.",
    question: "How can farming affect this watershed, and what can reduce nutrient loss?",
  },
  flood: {
    title: "Flood exposure", subtitle: "FEMA mapped flood hazards", color: "#83c8f2",
    explanation: "Floodplains show where mapped flood hazards affect land and communities. These are planning maps, not current flooding or forecasts. Areas outside mapped zones can still flood.",
    question: "What does this mapped flood classification mean for nearby communities?",
  },
} as const;
export function nutrientColor(value: number | null | undefined) {
  return value == null ? "#b9c2ca" : value < 3 ? "#87d7b5" : value < 10 ? "#f2bd67" : "#f18b80";
}
