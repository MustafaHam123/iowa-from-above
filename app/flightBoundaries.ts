export type MapPosition = { lat: number; lng: number };

export const FLIGHT_BOUNDARY_RADIUS_METERS = 6_000;

const METERS_PER_DEGREE_LATITUDE = 111_320;

export function clampToRadius(
  position: MapPosition,
  center: MapPosition,
  radiusMeters: number,
) {
  const metersPerDegreeLongitude =
    METERS_PER_DEGREE_LATITUDE * Math.cos((center.lat * Math.PI) / 180);
  const northMeters =
    (position.lat - center.lat) * METERS_PER_DEGREE_LATITUDE;
  const eastMeters = (position.lng - center.lng) * metersPerDegreeLongitude;
  const distanceMeters = Math.hypot(northMeters, eastMeters);

  if (distanceMeters <= radiusMeters || distanceMeters === 0) {
    return position;
  }

  const scale = radiusMeters / distanceMeters;

  return {
    lat: center.lat +
      (northMeters * scale) / METERS_PER_DEGREE_LATITUDE,
    lng: center.lng + (eastMeters * scale) / metersPerDegreeLongitude,
  };
}
