import { JOURNEY_STOPS, type JourneyPhase } from "./journeyStops";
import type { JourneyCheckpointPosition } from "./journeyProgress";

export type FlightSession = {
  version: 1;
  stopId: string;
  phase: Exclude<JourneyPhase, "transfer">;
  completed: number;
  shot: number;
  position: JourneyCheckpointPosition;
  portalPosition?: JourneyCheckpointPosition;
  boostCharges: number;
};
const KEY = "iowa-from-above:flight-session:v1";
export const FLIGHT_RESET_EVENT = "iowa-flight-reset";
const PHASES = new Set(["tutorial", "navigate", "cinematic", "question", "portal", "complete", "explore"]);
function validPosition(value: unknown): value is JourneyCheckpointPosition {
  if (!value || typeof value !== "object") return false;
  const p = value as JourneyCheckpointPosition;
  return [p.lat, p.lng, p.height, p.heading].every(Number.isFinite)
    && p.lat >= 40 && p.lat <= 44 && p.lng >= -97 && p.lng <= -90
    && p.height >= 50 && p.height <= 1_000_000;
}
function validSession(value: unknown): value is FlightSession {
  if (!value || typeof value !== "object") return false;
  const s = value as FlightSession;
  const index = JOURNEY_STOPS.findIndex(stop => stop.id === s.stopId);
  return s.version === 1 && index >= 0 && PHASES.has(s.phase)
    && Number.isInteger(s.completed) && s.completed >= 0 && s.completed <= JOURNEY_STOPS.length
    && Number.isInteger(s.shot) && s.shot >= 0 && s.shot <= 2
    && Number.isInteger(s.boostCharges) && s.boostCharges >= 0 && s.boostCharges <= 3
    && validPosition(s.position) && (s.phase !== "portal" || validPosition(s.portalPosition))
    && (s.phase === "explore" || s.phase === "complete" || s.completed === index || (s.phase === "question" && s.completed === index + 1))
    && (s.phase !== "complete" || s.completed === JOURNEY_STOPS.length);
}
export function loadFlightSession(): FlightSession | undefined {
  if (typeof window === "undefined") return;
  try { const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "null"); return validSession(value) ? value : undefined; }
  catch { return undefined; }
}
export function saveFlightSession(session: FlightSession) {
  if (typeof window === "undefined" || !validSession(session)) return;
  try { window.localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* Storage restrictions must not interrupt flight. */ }
}
export function clearFlightSession() {
  if (typeof window === "undefined") return;
  // Prevent pagehide/unmount from restoring a session the user just reset.
  window.dispatchEvent?.(new Event(FLIGHT_RESET_EVENT));
  try { window.localStorage.removeItem(KEY); } catch { /* Restart still works without storage. */ }
}
