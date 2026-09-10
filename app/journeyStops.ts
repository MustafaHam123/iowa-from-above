export type JourneyStop = {
  id: string;
  name: string;
  guideName?: string;
  theme: string;
  lat: number;
  lng: number;
  elevation: number;
  radius: number;
  script: [string, string, string];
  question: string;
  choices: [string, string];
  answer: number;
  source: string;
  /** One local recording per cinematic view, in the same order as `script`. */
  audio?: [string, string, string];
};

const narration = (id: string): [string, string, string] => [
  `/audio/journey/${id}-01.mp3`,
  `/audio/journey/${id}-02.mp3`,
  `/audio/journey/${id}-03.mp3`,
];

export function navigationGuidance(stop: JourneyStop) {
  const name = stop.guideName ?? stop.name;
  return {
    message: stop.id === "capitol"
      ? "Capitol ahead. Follow the purple line."
      : `Follow the purple line to ${name}.`,
    audio: `/audio/guidance/navigate-${stop.id}.mp3`,
  };
}

export function portalGuidance(stop: JourneyStop) {
  const name = stop.guideName ?? stop.name;
  return {
    message: `Fly through the portal to reach ${name}.`,
    audio: `/audio/guidance/portal-${stop.id}.mp3`,
  };
}

// Elevations are fallback camera targets in meters above the ellipsoid, not
// collision terrain. The controller prefers heights from already loaded tiles.
export const JOURNEY_STOPS: JourneyStop[] = [
  {
    id: "capitol", name: "Iowa State Capitol", theme: "Government", lat: 41.59118, lng: -93.60388, elevation: 275, radius: 360,
    script: [
      "There it is, the Iowa State Capitol. Start with the gold dome in the center, then look for the four smaller domes around it. Inside, Iowa's legislature meets to do the state's work.",
      "As we move around the building, notice how balanced it looks from side to side. The central dome draws your eye first, while the two wings hold the working spaces of state government.",
      "Now take in Des Moines beyond the Capitol grounds. Choices made in this building reach farms, towns, and river communities across Iowa. Before we move on, how many domes crown the Capitol?",
    ],
    audio: narration("capitol"),
    question: "How many domes crown the Capitol?", choices: ["Five", "Three"], answer: 0,
    source: "https://www.legis.iowa.gov/docs/publications/IF/793559.pdf",
  },
  {
    id: "living-history-farms", name: "Living History Farms", theme: "Agriculture", lat: 41.61694, lng: -93.77111, elevation: 285, radius: 520,
    script: [
      "Below us, Living History Farms tells Iowa's farming story across different periods, beginning with Indigenous agriculture and continuing through later farms and a town.",
      "Notice how the fields, buildings, and paths fit together. Farming has never been only about the crop. It also depends on soil, tools, labor, and the people who build a community around the work.",
      "From up here, you can see those pieces as one working landscape. The tools change over time, and so does the daily work. What part of Iowa's story is this place meant to help us understand?",
    ], audio: narration("living-history-farms"), question: "What story does this place tell?", choices: ["Ocean navigation", "Changes in farming"], answer: 1, source: "https://www.lhf.org/",
  },
  {
    id: "interstate-crossroads", name: "I-80 / I-35 / I-235 West Mixmaster", guideName: "the West Mixmaster", theme: "Transportation", lat: 41.5917139, lng: -93.7780566, elevation: 285, radius: 620,
    script: [
      "This is the West Mixmaster, where interstate routes meet on the western side of Des Moines. From the air, you can follow the lanes as they carry traffic toward different parts of Iowa.",
      "Pick one curved ramp and trace it with your eyes. It lets drivers change direction without crossing opposing traffic at a regular intersection. Even the shape of the land influences how the interchange is laid out.",
      "This connection serves everyday trips, local businesses, and farms moving a harvest to its next stop. What do those curved ramps help traffic do?",
    ], audio: narration("interstate-crossroads"), question: "What do interchange ramps connect?", choices: ["Different road directions", "Underground rivers"], answer: 0, source: "https://iowadot.gov/modes-travel/roads-highways/major-construction-projects/des-moines-area-interstate-projects",
  },
  {
    id: "high-trestle", name: "High Trestle Trail Bridge", theme: "Trails & engineering", lat: 41.86686, lng: -93.86929, elevation: 265, radius: 650,
    script: [
      "Ahead is the High Trestle Trail Bridge, stretching across the Des Moines River valley. Its long span gives people a view of the landscape from high above the water.",
      "Watch how the bridge joins the two sides of the valley. The steel frames over the trail are more than decoration. They refer to the mining history of this area.",
      "A bridge usually helps people get somewhere, but this one also gives them a reason to slow down and look around. Which river valley lies beneath us?",
    ], audio: narration("high-trestle"), question: "Which river lies below this crossing?", choices: ["Mississippi River", "Des Moines River"], answer: 1, source: "https://www.traveliowa.com/faq/",
  },
  {
    id: "ledges", name: "Ledges State Park", theme: "Water & rock", lat: 41.9884, lng: -93.8835, elevation: 265, radius: 650,
    script: [
      "We have reached Ledges State Park, where wooded slopes fold into a creek valley. It is a useful reminder that Iowa is not as flat as people sometimes imagine.",
      "Look for the valley cutting through the higher ground. Moving water has shaped it over time, and those slopes affect where plants grow and where people can travel.",
      "The tree canopy hides some of the smaller details, but the land still reveals its shape from above. What natural force helps carve a creek valley like this one?",
    ], audio: narration("ledges"), question: "What helps carve a creek valley?", choices: ["Moving water", "Streetlights"], answer: 0, source: "https://www.iowadnr.gov/places-go/state-parks/all-parks/ledges-state-park",
  },
  {
    id: "amana", name: "Amana Colonies", theme: "Community & craft", lat: 41.8007, lng: -91.8643, elevation: 220, radius: 520,
    script: [
      "The Amana Colonies are a group of seven villages founded by German immigrants. Their streets and buildings preserve a distinct part of Iowa's community history.",
      "From here, you can see how closely the village sits beside the surrounding land. Homes, workplaces, and shared institutions all shaped daily life here.",
      "Seven villages carry this history together. Do you remember how many make up the Amana Colonies?",
    ], audio: narration("amana"), question: "How many villages make up the colonies?", choices: ["Two", "Seven"], answer: 1, source: "https://www.traveliowa.com/cities/middle-amana-iowa/980/",
  },
  {
    id: "hoover", name: "Herbert Hoover National Historic Site", theme: "Iowa & the presidency", lat: 41.6689, lng: -91.3478, elevation: 220, radius: 370,
    script: [
      "We are over West Branch, the birthplace of Herbert Hoover. This national historic site preserves places connected to the early life of the thirty-first president.",
      "The view places his small-town beginning inside a much larger national story. These streets, homes, and open spaces help us picture the community he knew as a child.",
      "A modest home can become part of history far beyond the town around it. Whose childhood are we exploring here?",
    ], audio: narration("hoover"), question: "Who was born in West Branch?", choices: ["Herbert Hoover", "Abraham Lincoln"], answer: 0, source: "https://www.nps.gov/heho/index.htm",
  },
  {
    id: "field-of-dreams", name: "Field of Dreams", theme: "Film & rural Iowa", lat: 42.4977, lng: -91.0543, elevation: 295, radius: 420,
    script: [
      "That baseball diamond beside the farmland is the Field of Dreams site near Dyersville. An Iowa farm became a familiar movie setting, tying this rural landscape to a story known far beyond the state.",
      "Look at the clean shape of the ballfield against the fields around it. The farmland is part of the story, and a big reason this place is so easy to recognize.",
      "Places can gather new meaning without losing what they were before. This field is still part of Iowa farm country, and it is also remembered through film. Which sport defines the site?",
    ], audio: narration("field-of-dreams"), question: "Which sport is played on this field?", choices: ["Tennis", "Baseball"], answer: 1, source: "https://www.traveliowa.com/faq/",
  },
  {
    id: "pikes-peak", name: "Pikes Peak State Park", theme: "River systems", lat: 42.9955, lng: -91.1666, elevation: 310, radius: 850,
    script: [
      "From Pikes Peak State Park, the view opens across the Mississippi River. The broad water and steep bluffs give northeastern Iowa a shape that feels very different from the center of the state.",
      "Follow the river as it bends through the valley. It connects habitats and communities, and people have long followed waterways like this one when moving across the continent.",
      "Take in the full river system beyond the nearest shoreline. The islands, channels, and slopes all belong to the same landscape. Which major river are we looking across?",
    ], audio: narration("pikes-peak"), question: "Which river shapes this view?", choices: ["Mississippi River", "Colorado River"], answer: 0, source: "https://www.iowadnr.gov/places-go/state-parks/all-parks/pikes-peak-state-park",
  },
  {
    id: "effigy-mounds", name: "Effigy Mounds National Monument", theme: "Indigenous heritage", lat: 43.0921, lng: -91.1858, elevation: 320, radius: 720,
    script: [
      "Effigy Mounds National Monument protects sacred places built by Indigenous peoples. Some of the mounds were made in animal forms, including bears and birds.",
      "We will keep our view wide and respectful. These places are sacred and culturally important, so they deserve care rather than intrusion. The trees also hide many of the details from the air.",
      "More than two hundred known mounds are preserved here, along with living connections to associated Tribal Nations. What should guide the way we visit this landscape?",
    ], audio: narration("effigy-mounds"), question: "How should we approach this sacred landscape?", choices: ["Disturb the mounds", "With respect and care"], answer: 1, source: "https://home.nps.gov/efmo/learn/historyculture/efmonm.htm",
  },
  {
    id: "loess-hills", name: "Hitchcock Nature Center", theme: "Wind-shaped land", lat: 41.4217, lng: -95.8536, elevation: 350, radius: 850,
    script: [
      "Western Iowa rises into the Loess Hills. They formed from deposits of windblown silt, material fine enough for the wind to carry and leave behind.",
      "Keep an eye on the ridgelines as we turn. From the air, their folds and steep slopes stand apart from the broader land around them.",
      "Water continues to reshape these hills, but wind delivered the sediment that formed them. What material is loess made from?",
    ], audio: narration("loess-hills"), question: "What material forms loess?", choices: ["Windblown silt", "Coral reefs"], answer: 0, source: "https://www.traveliowa.com/the-loess-hills-iowas-famous-geological-gem/",
  },
  {
    id: "madison-county", name: "Roseman Covered Bridge", theme: "Connections through time", lat: 41.292768, lng: -94.149676, elevation: 285, radius: 450,
    script: [
      "Our final stop is Roseman Covered Bridge in Madison County. It is a small crossing, but it holds a much larger place in the identity of this community.",
      "Look at the creek, the road leading in, and the land on both sides. A bridge solves a practical problem, but its setting gives each crossing a different feel.",
      "We started at the Capitol and traveled through Iowa's farms, roads, rivers, and historic places. The landscape connects them, and people continue to care for each one. What has linked the stops on our journey?",
    ], audio: narration("madison-county"), question: "What connects the places we explored?", choices: ["They all look identical", "People and the landscape"], answer: 1, source: "https://industrypartners.traveliowa.com/travel-areas/",
  },
];

export type JourneyPhase = "tutorial" | "navigate" | "cinematic" | "question" | "portal" | "transfer" | "complete";
export type JourneyStatus = {
  phase: JourneyPhase;
  index: number;
  completed: number;
  message: string;
  caption: string;
  shot: number;
  distance: number;
  direction: string;
  targetBearing: number;
  feedback: string;
  selectedAnswer: number | null;
  answerCorrect: boolean | null;
};
export const INITIAL_JOURNEY: JourneyStatus = {
  phase: "tutorial",
  index: 0,
  completed: 0,
  message: "Finish the flight tutorial to begin your journey.",
  caption: "",
  shot: 0,
  distance: 0,
  direction: "",
  targetBearing: 0,
  feedback: "",
  selectedAnswer: null,
  answerCorrect: null,
};
