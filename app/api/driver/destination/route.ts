import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, zPlace } from "@/lib/http";
import { requireDriver } from "@/lib/driver";

export const POST = route(async (req) => {
  const { user } = await requireDriver({ approved: true });
  const { place } = await body(req, z.object({ place: zPlace.nullable() }));
  await sql`update driver_profiles set dest_filter_lat = ${place?.lat ?? null}, dest_filter_lng = ${place?.lng ?? null},
    dest_filter_label = ${place?.address ?? null}, updated_at = now() where user_id = ${user.id}`;
  return { ok: true };
});
