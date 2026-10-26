import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail } from "@/lib/http";
import { requireUser, userById, logout } from "@/lib/auth";

export const GET = route(async () => {
  const user = await requireUser();
  const [driver] = await sql`select status, online from driver_profiles where user_id = ${user.id}`;
  return { user, driver: driver ?? null };
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const input = await body(req, z.object({
    name: z.string().trim().min(1, "Enter your name").max(60).optional(),
    email: z.union([z.string().trim().email("Enter a valid email").max(120), z.literal("")]).optional(),
  }));
  if (input.name !== undefined) await sql`update users set name = ${input.name}, updated_at = now() where id = ${user.id}`;
  if (input.email !== undefined) await sql`update users set email = ${input.email || null}, updated_at = now() where id = ${user.id}`;
  return { user: await userById(user.id) };
});

/** Deletes the account: personal data removed, trips kept anonymised for accounting. */
export const DELETE = route(async () => {
  const user = await requireUser();
  const [live] = await sql`select id from trips where (rider_id = ${user.id} or driver_id = ${user.id})
    and status in ('matching','accepted','arrived','in_progress') limit 1`;
  if (live) throw fail(409, "Finish or cancel your current ride before deleting your account.", "live_trip");
  await sql.begin(async (tx) => {
    await tx`delete from saved_places where user_id = ${user.id}`;
    await tx`delete from avatars where user_id = ${user.id}`;
    await tx`delete from payment_methods where user_id = ${user.id}`;
    await tx`delete from driver_documents where driver_id = ${user.id}`;
    await tx`update driver_profiles set online = false, status = 'suspended', licence_no = 'deleted', last_lat = null, last_lng = null where user_id = ${user.id}`;
    await tx`update vehicles set active = false, plate = 'deleted' where driver_id = ${user.id}`;
    await tx`update trips set guest_name = null, guest_phone = null where rider_id = ${user.id}`;
    await tx`delete from messages where sender_id = ${user.id}`;
    await tx`update users set phone = ${"deleted:" + user.id}, name = null, email = null, deleted_at = now() where id = ${user.id}`;
    await tx`delete from sessions where user_id = ${user.id}`;
  });
  await logout();
  return { ok: true };
});
