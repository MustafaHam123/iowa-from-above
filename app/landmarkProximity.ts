import { distanceKm } from "./environmentalStories";
type Place = { id: string; lat: number; lng: number };

/** Enter at 750 m, leave at 1 km so a boundary cannot repeatedly reopen a card. */
export function createLandmarkProximity<T extends Place>(places: readonly T[]) {
  let activeId: string | undefined;
  const dismissed = new Set<string>();
  return {
    update(position: { lat: number; lng: number }): T | undefined {
      const distances = places.map(place => ({ place, km: distanceKm(position, place) }));
      for (const { place, km } of distances) if (km > 1) dismissed.delete(place.id);
      if (distances.some(({ place, km }) => place.id === activeId && km <= 1)) return;
      activeId = undefined;
      const nearby = distances.filter(({ place, km }) => km <= 0.75 && !dismissed.has(place.id)).sort((a, b) => a.km - b.km)[0]?.place;
      if (nearby) activeId = nearby.id;
      return nearby;
    },
    opened(id: string) { activeId = id; dismissed.delete(id); },
    dismiss(id: string) { dismissed.add(id); },
  };
}
