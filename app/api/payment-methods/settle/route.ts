import { sql } from "@/lib/db";
import { route, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { charge } from "@/lib/payments";

/** Retries unpaid fares and fees on the default payment method. */
export const POST = route(async () => {
  const user = await requireUser();
  const [pm] = await sql`select id from payment_methods where user_id = ${user.id} and is_default`;
  if (!pm) throw fail(402, "Add a payment method first.", "no_payment_method");
  const unpaid = await sql`select c.* from charges c where c.user_id = ${user.id} and c.status = 'failed' and c.kind <> 'tip'
    and not exists (select 1 from charges c2 where c2.trip_id = c.trip_id and c2.kind = c.kind and c2.status = 'succeeded')`;
  let paid = 0, failed = 0;
  for (const c of unpaid) {
    const r = await charge({ tripId: c.trip_id, userId: user.id, kind: c.kind, amountCents: c.amount_cents, currency: c.currency,
      paymentMethodId: pm.id, key: `settle:${c.id}:${pm.id}` });
    if (r.status === "succeeded") paid++; else failed++;
  }
  if (failed) throw fail(402, "That card was declined too. Try a different one.", "card_declined", { paid });
  return { paid };
});
