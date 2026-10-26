export type LatLng = { lat: number; lng: number };

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from a to b, degrees 0-360. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point a fraction t (0-1) of the way from a to b. */
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Move from `from` toward `to` by up to `metres`. */
export function stepToward(from: LatLng, to: LatLng, metres: number): LatLng {
  const d = haversine(from, to);
  if (d <= metres || d === 0) return { ...to };
  return lerp(from, to, metres / d);
}

export type Box = { min_lat: number; max_lat: number; min_lng: number; max_lng: number };
export function inArea(p: LatLng, box: Box): boolean {
  return p.lat >= box.min_lat && p.lat <= box.max_lat && p.lng >= box.min_lng && p.lng <= box.max_lng;
}

export function isLatLng(p: unknown): p is LatLng {
  const q = p as LatLng;
  return !!q && Number.isFinite(q.lat) && Number.isFinite(q.lng) && Math.abs(q.lat) <= 90 && Math.abs(q.lng) <= 180;
}
