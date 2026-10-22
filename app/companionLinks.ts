import { JOURNEY_STOPS } from "./journeyStops";
export function knownPlaceId(value: string | null | undefined): string | null {
  return value && JOURNEY_STOPS.some((place) => place.id === value) ? value : null;
}
export function previewPlaceId(): string | null {
  return typeof window === "undefined" ? null : knownPlaceId(new URLSearchParams(window.location.search).get("place"));
}
export function parsePlaceLink(text: string, currentOrigin?: string): string | null {
  try {
    const url = new URL(text.trim());
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol === "fromabove:" && url.hostname === "place" && parts.length === 1) return knownPlaceId(parts[0]);
    const allowed = new Set(["iowa-from-above.vercel.app", "localhost", "127.0.0.1"]);
    if (currentOrigin) allowed.add(new URL(currentOrigin).hostname);
    if (!["http:", "https:"].includes(url.protocol) || !allowed.has(url.hostname) || url.username || url.password) return null;
    if (parts.length === 2 && ["places", "exhibits"].includes(parts[0])) return knownPlaceId(parts[1]);
    return parts.length === 0 ? knownPlaceId(url.searchParams.get("place")) : null;
  } catch { return null; }
}
