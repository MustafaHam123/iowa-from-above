import { ENVIRONMENTAL_ISSUES } from "./environmentalJourney";

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

const RECORDED_GUIDANCE = new Set(["capitol", "high-trestle", "loess-hills", "ledges", "pikes-peak"]);

export function navigationGuidance(stop: JourneyStop) {
  const name = stop.guideName ?? stop.name;
  return {
    message: stop.id === "capitol"
      ? "Capitol ahead. Follow the purple line."
      : `Follow the purple line to ${name}.`,
    audio: RECORDED_GUIDANCE.has(stop.id) ? `/audio/guidance/navigate-${stop.id}.mp3` : undefined,
  };
}

export function portalGuidance(stop: JourneyStop) {
  const name = stop.guideName ?? stop.name;
  return {
    message: `Fly through the portal to reach ${name}.`,
    audio: RECORDED_GUIDANCE.has(stop.id) ? `/audio/guidance/portal-${stop.id}.mp3` : undefined,
  };
}

// Elevations are fallback camera targets in meters above the ellipsoid, not
// collision terrain. The controller prefers heights from already loaded tiles.
const ISSUE_PLACES = [
  {
    "id": "capitol",
    "guideName": "Iowa State Capitol",
    "lat": 41.59118,
    "lng": -93.60388,
    "elevation": 275,
    "radius": 360
  },
  {
    "id": "water-works",
    "guideName": "Water Works Park",
    "lat": 41.57566,
    "lng": -93.64635,
    "elevation": 245,
    "radius": 520
  },
  {
    "id": "raccoon-monitor",
    "guideName": "Raccoon River at Van Meter",
    "lat": 41.5340277777778,
    "lng": -93.9497777777778,
    "elevation": 255,
    "radius": 520
  },
  {
    "id": "high-trestle",
    "guideName": "High Trestle Trail Bridge",
    "lat": 41.86686,
    "lng": -93.86929,
    "elevation": 265,
    "radius": 650
  },
  {
    "id": "saylorville",
    "guideName": "Saylorville Lake",
    "lat": 41.7035992517482,
    "lng": -93.6893874793302,
    "elevation": 275,
    "radius": 700
  },
  {
    "id": "chichaqua",
    "guideName": "Chichaqua Bottoms Greenbelt",
    "lat": 41.794564,
    "lng": -93.444807,
    "elevation": 255,
    "radius": 650
  },
  {
    "id": "hoover",
    "guideName": "Hoover Creek",
    "lat": 41.6689,
    "lng": -91.3478,
    "elevation": 220,
    "radius": 370
  },
  {
    "id": "neal-smith",
    "guideName": "Neal Smith National Wildlife Refuge",
    "lat": 41.5591872,
    "lng": -93.28016,
    "elevation": 290,
    "radius": 650
  },
  {
    "id": "pikes-peak",
    "guideName": "Pikes Peak State Park",
    "lat": 42.9955,
    "lng": -91.1666,
    "elevation": 310,
    "radius": 850
  },
  {
    "id": "bear-creek",
    "guideName": "the Bear Creek watershed",
    "lat": 42.18333333333333,
    "lng": -93.5,
    "elevation": 305,
    "radius": 650
  },
  {
    "id": "loess-hills",
    "guideName": "Hitchcock Nature Center",
    "lat": 41.4217,
    "lng": -95.8536,
    "elevation": 350,
    "radius": 850
  },
  {
    "id": "ledges",
    "guideName": "Ledges State Park",
    "lat": 41.9884,
    "lng": -93.8835,
    "elevation": 265,
    "radius": 650
  }
];

// Flight and portal mechanics stay unchanged. New places use captions until
// matching narration exists; unrelated sightseeing recordings are never reused.
export const JOURNEY_STOPS: JourneyStop[] = ISSUE_PLACES.map((stop) => {
  const issue = ENVIRONMENTAL_ISSUES[stop.id];
  return {
    ...stop,
    guideName: stop.guideName,
    name: issue.title,
    theme: issue.title,
    script: [issue.problem, issue.impact, issue.solution],
    question: issue.question, choices: issue.choices, answer: issue.answer,
    source: issue.source.url,
    audio: undefined,
  };
});

export type JourneyPhase = "tutorial" | "navigate" | "cinematic" | "question" | "portal" | "transfer" | "complete" | "explore";
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
