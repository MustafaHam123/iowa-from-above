import { JOURNEY_STOPS } from "./journeyStops";
import { clearFlightSession } from "./flightSession";

export type JourneyCheckpointPosition = {
  lat: number;
  lng: number;
  height: number;
  heading: number;
};

export type JourneyCheckpoint = {
  completed: number;
  position: JourneyCheckpointPosition;
  boostCharges: number;
};

type StoredJourneyCheckpoint = JourneyCheckpoint & {
  version: 2;
  completedStopId: string;
};

// The environmental route has different destinations and ordering. Old
// sightseeing progress cannot safely resume at the same numeric position.
const JOURNEY_PROGRESS_STORAGE_KEY = "iowa-from-above:journey-checkpoint:v2";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function loadJourneyCheckpoint(): JourneyCheckpoint | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(JOURNEY_PROGRESS_STORAGE_KEY) ?? "null",
    ) as Partial<StoredJourneyCheckpoint> | null;

    if (!stored || stored.version !== 2 || typeof stored.completedStopId !== "string") {
      return undefined;
    }

    const completedIndex = JOURNEY_STOPS.findIndex(
      (stop) => stop.id === stored.completedStopId,
    );
    const position = stored.position;

    if (
      completedIndex < 0 ||
      !position ||
      !isFiniteNumber(position.lat) ||
      !isFiniteNumber(position.lng) ||
      !isFiniteNumber(position.height) ||
      !isFiniteNumber(position.heading) ||
      position.lat < 40 ||
      position.lat > 44 ||
      position.lng < -97 ||
      position.lng > -90 ||
      position.height < 50 ||
      position.height > 2_000
    ) {
      return undefined;
    }

    return {
      completed: completedIndex + 1,
      position: {
        lat: position.lat,
        lng: position.lng,
        height: position.height,
        heading: position.heading,
      },
      boostCharges: Math.min(
        3,
        Math.max(0, Math.floor(Number(stored.boostCharges) || 0)),
      ),
    };
  } catch {
    return undefined;
  }
}

export function saveJourneyCheckpoint(checkpoint: JourneyCheckpoint) {
  if (typeof window === "undefined" || checkpoint.completed < 1) {
    return;
  }

  const completed = Math.min(
    JOURNEY_STOPS.length,
    Math.max(1, Math.floor(checkpoint.completed)),
  );
  const completedStop = JOURNEY_STOPS[completed - 1];
  const stored: StoredJourneyCheckpoint = {
    version: 2,
    completedStopId: completedStop.id,
    completed,
    position: { ...checkpoint.position },
    boostCharges: Math.min(3, Math.max(0, Math.floor(checkpoint.boostCharges))),
  };

  try {
    window.localStorage.setItem(
      JOURNEY_PROGRESS_STORAGE_KEY,
      JSON.stringify(stored),
    );
  } catch {
    // Private browsing or a full device store must not interrupt the game.
  }
}

export function clearJourneyCheckpoint() {
  clearFlightSession();
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(JOURNEY_PROGRESS_STORAGE_KEY);
    window.localStorage.removeItem("iowa-from-above:journey-checkpoint:v1");
  } catch {
    // Storage restrictions must not prevent the game from restarting.
  }
}
