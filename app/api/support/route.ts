import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, zUuid } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadTripFor } from "@/lib/trips";

export const GET = route(async () => {
  const user = await requireUser();
  return { tickets: await sql`select id, trip_id, category, body, status, resolution, refund_cents, created_at
    from support_tickets where user_id = ${user.id} order by created_at desc limit 50` };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const i = await body(req, z.object({
    tripId: zUuid.optional(),
    category: z.enum(["fare", "cancellation_fee", "route", "lost_item", "safety", "driver", "other"]),
    body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  }));
  if (i.tripId) await loadTripFor(user, i.tripId);
  const [t] = await sql`insert into support_tickets (trip_id, user_id, category, body)
    values (${i.tripId ?? null}, ${user.id}, ${i.category}, ${i.body}) returning id, status, created_at`;
  return { ticket: t };
});
