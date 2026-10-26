import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail, zLatLng } from "@/lib/http";
import { requireDriver } from "@/lib/driver";

export const POST = route(async (req) => {
  const { user } = await requireDriver({ approved: true });
  const { online, position } = await body(req, z.object({ online: z.boolean(), position: zLatLng.optional() }));
  if (online) {
    const [v] = await sql`select id from vehicles where driver_id = ${user.id} and active limit 1`;
    if (!v) throw fail(409, "Add a vehicle before going online.", "no_vehicle");
    if (position) await sql`update driver_profiles set last_lat = ${position.lat}, last_lng = ${position.lng}, last_seen_at = now() where user_id = ${user.id}`;
    const [p] = await sql`select last_lat from driver_profiles where user_id = ${user.id}`;
    if (p.last_lat == null) throw fail(409, "We need your location to send you requests.", "no_location");
  } else {
    // Going offline hands back any offer on screen.
    await sql`update dispatch_offers set response = 'declined', responded_at = now() where driver_id = ${user.id} and response = 'pending'`;
  }
  await sql`update driver_profiles set online = ${online}, last_seen_at = now(), updated_at = now() where user_id = ${user.id}`;
  return { online };
});
