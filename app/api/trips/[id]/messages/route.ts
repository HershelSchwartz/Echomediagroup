import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadTripFor } from "@/lib/trips";

async function partyTrip(id: string) {
  const user = await requireUser();
  const t = await loadTripFor(user, id);
  if (t.rider_id !== user.id && t.driver_id !== user.id) throw fail(403, "Only the rider and driver can chat.", "forbidden");
  return { user, t };
}

export const GET = route(async (_req, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const { user } = await partyTrip(id);
  await sql`update messages set read_at = now() where trip_id = ${id} and sender_id <> ${user.id} and read_at is null`;
  const rows = await sql`select id, body, created_at, sender_id = ${user.id} as mine from messages where trip_id = ${id} order by created_at limit 200`;
  return { messages: rows };
});

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  const { id } = await ctx.params;
  const { user, t } = await partyTrip(id);
  if (!["accepted", "arrived", "in_progress"].includes(t.status)) throw fail(409, "Chat is open while a driver is on the way or on the trip.", "bad_state");
  const { text } = await body(req, z.object({ text: z.string().trim().min(1, "Type a message").max(500) }));
  const [m] = await sql`insert into messages (trip_id, sender_id, body) values (${id}, ${user.id}, ${text}) returning id, body, created_at, true as mine`;
  return { message: m };
});
