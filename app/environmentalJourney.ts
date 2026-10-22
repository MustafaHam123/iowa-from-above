import type { EnvironmentalLayer } from "./environment";

export type EnvironmentalIssue = {
  title: string; place: string; layer: EnvironmentalLayer;
  problem: string; impact: string; solution: string;
  question: string; choices: [string, string]; answer: number;
  source: { label: string; url: string };
};
const nutrients = { label: "Iowa DNR · Nutrient reduction", url: "https://www.iowadnr.gov/environmental-protection/water-quality/nutrient-reduction-strategy" };

// Real monitoring, restoration and water-management places. General mechanisms
// are distinguished from measured conditions. Coordinates are in journeyStops.ts.
export const ENVIRONMENTAL_ISSUES: Record<string, EnvironmentalIssue> = {
  "water-works": {
    title: "Drinking Water", place: "Water Works Park", layer: "water",
    problem: "The Raccoon and Des Moines rivers help supply central Iowa's drinking water. Nitrate in source water can add treatment demands.",
    impact: "CIWW documented nitrate-related treatment constraints in 2025. Raw river measurements are not measurements of treated tap water.",
    solution: "Combine upstream nutrient reduction with utility testing and treatment. Use the utility's reports for drinking-water results.",
    question: "Is river water tap water?", choices: ["No, treatment matters", "Yes, always identical"], answer: 0,
    source: { label: "CIWW · Source-water challenges (2025)", url: "https://ciww.gov/water-challenges-met-this-summer-with-assistance-from-central-iowans-and-regional-communities/" },
  },
  "raccoon-monitor": {
    title: "River Monitoring", place: "Raccoon River at Van Meter", layer: "water",
    problem: "USGS station 05484500 measures conditions in the Raccoon River upstream of Des Moines.",
    impact: "Dated nitrate-plus-nitrite observations connect the upstream watershed to a river used for water supply. Conditions change over time.",
    solution: "Inspect actual observations and their dates, then consider conservation across the watershed. One reading cannot name a polluter.",
    question: "What makes evidence useful?", choices: ["Water's visible color", "A dated measurement"], answer: 1,
    source: { label: "USGS · Raccoon River at Van Meter", url: "https://waterdata.usgs.gov/monitoring-location/USGS-05484500/" },
  },
  saylorville: {
    title: "Flood Control", place: "Saylorville Lake", layer: "flood",
    problem: "The Des Moines River can carry more water than downstream communities can safely accommodate.",
    impact: "Saylorville stores water to help reduce downstream flood risk. A reservoir reduces risk; it cannot eliminate every flood.",
    solution: "Combine reservoir management with floodplain planning, upstream conservation and official flood warnings.",
    question: "Can a dam end flood risk?", choices: ["No, risk remains", "Yes, everywhere"], answer: 0,
    source: { label: "USACE · Saylorville flood management", url: "https://www.mvr.usace.army.mil/saylorvillelake/about-us/" },
  },
  chichaqua: {
    title: "Wetland Loss", place: "Chichaqua Bottoms Greenbelt", layer: "watershed",
    problem: "Chichaqua preserves old Skunk River channels, wetlands and prairie. These habitats depend on room for water.",
    impact: "Drainage and habitat loss can remove wetland functions. Polk County began acquiring this land to preserve and restore the old oxbows.",
    solution: "Protect wetlands and restore appropriate oxbows and native vegetation with land managers.",
    question: "Why protect old oxbows?", choices: ["They stop every flood", "Habitat and storage"], answer: 1,
    source: { label: "Polk County · Chichaqua restoration", url: "https://www.polkcountyiowa.gov/conservation/parks-trails/chichaqua-bottoms-greenbelt" },
  },
  "neal-smith": {
    title: "Prairie Loss", place: "Neal Smith National Wildlife Refuge", layer: "watershed",
    problem: "Much of Iowa's native tallgrass prairie has disappeared. Neal Smith restores prairie, oak savanna and sedge meadow.",
    impact: "Fragmented habitat affects native wildlife. Restored prairie reconnects people with the landscape Iowa has lost.",
    solution: "Support native habitat restoration. Appropriately placed prairie vegetation can also help protect soil and water.",
    question: "What is restored here?", choices: ["Native prairie habitats", "More paved ground"], answer: 0,
    source: { label: "USFWS · Neal Smith restoration", url: "https://www.fws.gov/refuge/neal-smith" },
  },
  "bear-creek": {
    title: "Stream Buffers", place: "Bear Creek watershed", layer: "watershed",
    problem: "Bear Creek is an Iowa research watershed for protecting streams where farmland meets water.",
    impact: "Iowa State researchers study riparian buffers here. Vegetation can intercept overland runoff; buried drains need appropriate treatment too.",
    solution: "Use streamside buffers and drainage practices suited to each field. This marker locates the published study area, not a measured pollution plume.",
    question: "What can protect stream edges?", choices: ["Removing vegetation", "Streamside buffers"], answer: 1,
    source: { label: "Iowa State · Bear Creek buffer research", url: "https://www.ent.iastate.edu/imagegal/practices/buffer/bufferstrip_aerial.html" },
  },

  capitol: {
    title: "Water Decisions", place: "Iowa State Capitol", layer: "watershed",
    problem: "Water crosses county lines. Protecting it takes decisions across entire watersheds.",
    impact: "Communities downstream depend on what happens upstream.",
    solution: "Support watershed planning, monitoring and conservation across communities.",
    question: "What connects water decisions?", choices: ["Watershed boundaries", "County lines only"], answer: 0,
    source: { label: "Iowa DNR · Water planning", url: "https://www.iowadnr.gov/environmental-protection/water-quality/iowas-water-plan" },
  },
  "high-trestle": {
    title: "Nutrient Runoff", place: "High Trestle Trail Bridge", layer: "water",
    problem: "The Des Moines River connects upstream land with downstream communities.",
    impact: "Fertilizer and manure can lose nutrients through runoff and field drainage. A river reading cannot identify a specific source.",
    solution: "Compare dated USGS observations, then explore upstream conservation practices.",
    question: "What does monitoring show?", choices: ["A specific polluter", "Observed conditions"], answer: 1, source: nutrients,
  },
  ledges: {
    title: "Flood Exposure", place: "Ledges State Park", layer: "flood",
    problem: "Creek crossings and low ground at Ledges show how water and access share a valley.",
    impact: "Mapped flood zones help explain exposure; they do not show whether flooding is happening now.",
    solution: "Use official warnings for current conditions and protect space for floodwater.",
    question: "Are flood zones live?", choices: ["No, mapped hazards", "Yes, current floods"], answer: 0,
    source: { label: "Iowa DNR · Ledges", url: "https://www.iowadnr.gov/places-go/state-parks/all-parks/ledges-state-park" },
  },
  hoover: {
    title: "Creek Restoration", place: "Herbert Hoover National Historic Site", layer: "flood",
    problem: "Hoover Creek links this historic site with a real flood-management challenge.",
    impact: "The National Park Service has assessed creek restoration and stabilization for flood mitigation here.",
    solution: "Restore creek function while protecting historic places and nearby communities.",
    question: "What supports flood resilience?", choices: ["Creek restoration", "Ignoring drainage"], answer: 0,
    source: { label: "NPS · Hoover Creek assessment", url: "https://parkplanning.nps.gov/document.cfm?documentID=92722" },
  },
  "pikes-peak": {
    title: "Downstream Pollution", place: "Pikes Peak State Park", layer: "watershed",
    problem: "The Mississippi connects Iowa's waterways with communities far downstream.",
    impact: "Nutrients can travel beyond the place where they enter a river.",
    solution: "Reduce nutrient losses throughout the watershed, rather than only at its outlet.",
    question: "Where can nutrients travel?", choices: ["Farther downstream", "Only one field"], answer: 0, source: nutrients,
  },
  "loess-hills": {
    title: "Erosion Prevention", place: "Hitchcock Nature Center", layer: "watershed",
    problem: "The Loess Hills' steep slopes make protecting soil and native habitat important.",
    impact: "Hitchcock protects prairie and woodland that help prevent erosion and support water quality.",
    solution: "Keep protective vegetation and restore native habitats with land managers.",
    question: "What helps hold soil?", choices: ["Protective vegetation", "Exposed slopes"], answer: 0,
    source: { label: "Pottawattamie Conservation · Hitchcock", url: "https://www.pottconservation.com/parks/hitchcock_nature_center/" },
  },
};
