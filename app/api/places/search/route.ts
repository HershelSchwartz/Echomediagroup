import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { searchPlaces } from "@/lib/maps";
import { defaultCity } from "@/lib/trips";

export const GET = route(async (req) => {
  await requireUser();
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 100);
  if (q.trim().length < 2) return { places: [] };
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  const city = await defaultCity();
  const near = Number.isFinite(lat) && Number.isFinite(lng) && u.searchParams.has("lat") ? { lat, lng } : null;
  return { places: await searchPlaces(q, city.id, near) };
});
