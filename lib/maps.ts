import { sql } from "./db";
import { haversine, type LatLng } from "./geo";

export type Route = { distanceM: number; durationS: number; geometry: LatLng[]; source: "mapbox" | "estimate" };
export type PlaceHit = { name: string; address: string; lat: number; lng: number };

const token = () => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const DETOUR = 1.35; // streets are longer than a straight line
const CITY_SPEED_MS = 6.1; // ~22 km/h average city speed
const STOP_S = 60;

/** Straight-line estimate. Used for live ETAs (polled often) and when no provider is set. */
export function estimateRoute(points: LatLng[]): Route {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]) * DETOUR;
  const stops = Math.max(0, points.length - 2);
  return { distanceM: Math.round(d), durationS: Math.round(d / CITY_SPEED_MS + stops * STOP_S), geometry: points, source: "estimate" };
}

/** Driving route through the points via Mapbox Directions, else the estimate. */
export async function route(points: LatLng[]): Promise<Route> {
  if (!token()) return estimateRoute(points);
  try {
    const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?geometries=geojson&overview=simplified&access_token=${token()}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const r = j.routes?.[0];
    if (!r) throw new Error("no route");
    return {
      distanceM: Math.round(r.distance),
      durationS: Math.round(r.duration),
      geometry: r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })),
      source: "mapbox",
    };
  } catch (e) {
    console.warn("route: falling back to estimate", e);
    return estimateRoute(points);
  }
}

/**
 * A readable label for a raw point (the rider's GPS position or a dropped pin), so the
 * driver never sees "Current location". Mapbox reverse geocoding when set, else the
 * nearest seeded place within 400 m, else rounded coordinates.
 */
export async function describePoint(p: LatLng, cityId: string): Promise<string> {
  if (token()) {
    try {
      const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${p.lng}&latitude=${p.lat}&limit=1&access_token=${token()}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const f = (await res.json()).features?.[0];
        if (f) return f.properties.full_address ?? f.properties.name;
      }
    } catch (e) {
      console.warn("reverse: falling back", e);
    }
  }
  const rows = await sql`select name, lat, lng from places where city_id = ${cityId}`;
  let best: { name: string; d: number } | null = null;
  for (const r of rows) {
    const d = haversine(p, { lat: r.lat, lng: r.lng });
    if (d <= 400 && (!best || d < best.d)) best = { name: r.name, d };
  }
  if (best) return best.d < 60 ? best.name : `Near ${best.name}`;
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

/** Address search: Mapbox Geocoding near the city, else the seeded places list. */
export async function searchPlaces(q: string, cityId: string, near: LatLng | null): Promise<PlaceHit[]> {
  const coord = q.trim().match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (coord) {
    const lat = Number(coord[1]), lng = Number(coord[2]);
    return [{ name: "Dropped pin", address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng }];
  }
  const [city] = await sql`select * from cities where id = ${cityId}`;
  if (token() && city) {
    try {
      const p = near ?? { lat: city.center_lat, lng: city.center_lng };
      const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
      url.search = new URLSearchParams({
        q, access_token: token(), limit: "6", autocomplete: "true",
        proximity: `${p.lng},${p.lat}`,
        bbox: `${city.min_lng},${city.min_lat},${city.max_lng},${city.max_lat}`,
      }).toString();
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      return (j.features ?? []).map((f: { properties: { name: string; full_address?: string; place_formatted?: string }; geometry: { coordinates: [number, number] } }) => ({
        name: f.properties.name,
        address: f.properties.full_address ?? f.properties.place_formatted ?? f.properties.name,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
    } catch (e) {
      console.warn("search: falling back to places table", e);
    }
  }
  const like = `%${q.trim().replace(/[%_\\]/g, (m) => "\\" + m)}%`;
  const rows = await sql`select name, address, lat, lng from places
    where city_id = ${cityId} and (name ilike ${like} or address ilike ${like}) order by name limit 8`;
  return rows as unknown as PlaceHit[];
}
