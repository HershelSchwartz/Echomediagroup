import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, zUuid } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadTripFor } from "@/lib/trips";
import { refund } from "@/lib/payments";

export const GET = route(async () => {
  const user = await requireUser();
  return { tickets: await sql`select id, trip_id, category, body, status, resolution, refund_cents, created_at
    from support_tickets where user_id = ${user.id} order by created_at desc limit 50` };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const i = await body(req, z.object({
    tripId: zUuid.optional(),
    category: z.enum(["fare", "cancellation_fee", "route", "lost_item", "safety", "driver", "account_review", "other"]),
    body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  }));
  if (i.tripId) await loadTripFor(user, i.tripId);
  const [t] = await sql`insert into support_tickets (trip_id, user_id, category, body)
    values (${i.tripId ?? null}, ${user.id}, ${i.category}, ${i.body}) returning id, status, created_at`;

  // Benefit of the doubt: a rider's first cancellation-fee dispute in 90 days is refunded at once.
  if (i.category === "cancellation_fee" && i.tripId) {
    const [fee] = await sql`select coalesce(sum(amount_cents) filter (where kind = 'cancellation' and status = 'succeeded'), 0)::int as paid,
        coalesce(-sum(amount_cents) filter (where kind = 'refund'), 0)::int as refunded
      from charges where trip_id = ${i.tripId}`;
    const [{ n }] = await sql`select count(*)::int as n from support_tickets
      where user_id = ${user.id} and category = 'cancellation_fee' and refund_cents > 0 and created_at > now() - interval '90 days'`;
    const owed = fee.paid - fee.refunded;
    if (owed > 0 && n === 0) {
      await refund(i.tripId, owed, `auto:${t.id}`);
      await sql`update support_tickets set status = 'resolved', refund_cents = ${owed},
          resolution = 'Refunded automatically. Your first cancellation-fee dispute is always on us.', updated_at = now()
        where id = ${t.id}`;
      return { ticket: { ...t, status: "resolved" }, refundedCents: owed };
    }
  }
  return { ticket: t };
});
