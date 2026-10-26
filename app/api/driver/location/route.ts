import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, zLatLng } from "@/lib/http";
import { requireDriver } from "@/lib/driver";
import { haversine } from "@/lib/geo";

const STOP_REACHED_M = 80;

export const POST = route(async (req) => {
  const { user } = await requireDriver();
  const p = await body(req, zLatLng.extend({ heading: z.number().min(0).max(360).nullable().optional() }));
  await sql`update driver_profiles set last_lat = ${p.lat}, last_lng = ${p.lng}, heading = ${p.heading ?? null}, last_seen_at = now()
    where user_id = ${user.id}`;
  const [trip] = await sql`select id, status from trips where driver_id = ${user.id} and status in ('accepted','arrived','in_progress')`;
  if (trip) {
    await sql`insert into trip_locations (trip_id, lat, lng) values (${trip.id}, ${p.lat}, ${p.lng})`;
    if (trip.status === "in_progress") {
      const [next] = await sql`select id, lat, lng from trip_stops where trip_id = ${trip.id} and reached_at is null order by seq limit 1`;
      if (next && haversine(p, { lat: next.lat, lng: next.lng }) <= STOP_REACHED_M) await sql`update trip_stops set reached_at = now() where id = ${next.id}`;
    }
  }
  return { ok: true };
});
