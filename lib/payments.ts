import Stripe from "stripe";
import { sql, type Tx } from "./db";
import { fail, isUnique } from "./http";

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}
export const stripeMode = () => !!process.env.STRIPE_SECRET_KEY;

/** Dev cards: ending 0002 always declines, anything else succeeds. Mirrors Stripe test cards. */
export const DEV_DECLINE_LAST4 = "0002";

export type ChargeKind = "fare" | "tip" | "cancellation" | "refund";
type ChargeRow = { id: string; status: "pending" | "succeeded" | "failed"; amount_cents: number; failure_reason: string | null };

/**
 * Charges the trip's payment method once per idempotency key. A retried call returns the
 * same charge row and never charges twice; the key is also passed to Stripe.
 */
export async function charge(opts: {
  tripId: string; userId: string; kind: Exclude<ChargeKind, "refund">; amountCents: number; currency: string;
  paymentMethodId: string | null; key: string;
}): Promise<ChargeRow> {
  const { tripId, userId, kind, amountCents, currency, paymentMethodId, key } = opts;
  if (amountCents <= 0) throw fail(400, "Nothing to charge", "invalid");
  let row: ChargeRow;
  try {
    [row] = (await sql`insert into charges (trip_id, user_id, kind, amount_cents, currency, idempotency_key)
      values (${tripId}, ${userId}, ${kind}, ${amountCents}, ${currency}, ${key})
      returning id, status, amount_cents, failure_reason`) as unknown as ChargeRow[];
  } catch (e) {
    if (!isUnique(e)) throw e;
    const [existing] = (await sql`select id, status, amount_cents, failure_reason from charges where idempotency_key = ${key}`) as unknown as ChargeRow[];
    if (existing.status !== "pending") return existing;
    row = existing;
  }

  const [pm] = paymentMethodId ? await sql`select * from payment_methods where id = ${paymentMethodId}` : [];
  let status: "succeeded" | "failed" | "pending" = "failed";
  let ref: string | null = null;
  let reason: string | null = null;
  if (!pm) {
    reason = "no_payment_method";
  } else if (pm.kind === "cash") {
    status = "succeeded";
    ref = "cash";
  } else if (pm.provider === "dev") {
    if (pm.last4 === DEV_DECLINE_LAST4) reason = "card_declined";
    else { status = "succeeded"; ref = `dev_${row.id.slice(0, 8)}`; }
  } else {
    const s = stripe();
    if (!s) reason = "payments_unconfigured";
    else {
      try {
        const pi = await s.paymentIntents.create(
          {
            amount: amountCents, currency, customer: pm.provider_customer_id, payment_method: pm.provider_pm_id,
            off_session: true, confirm: true, metadata: { trip_id: tripId, charge_id: row.id, kind },
          },
          { idempotencyKey: key },
        );
        ref = pi.id;
        status = pi.status === "succeeded" ? "succeeded" : pi.status === "processing" ? "pending" : "failed";
        if (status === "failed") reason = pi.status;
      } catch (e) {
        const err = e as { code?: string; payment_intent?: { id: string } };
        ref = err.payment_intent?.id ?? null;
        reason = err.code ?? "card_error";
      }
    }
  }
  const [updated] = (await sql`update charges set status = ${status}, provider_ref = ${ref}, failure_reason = ${reason}, updated_at = now()
    where id = ${row.id} returning id, status, amount_cents, failure_reason`) as unknown as ChargeRow[];
  return updated;
}

/** Refunds up to the trip's captured fare + fees. Records a negative 'refund' charge row. */
export async function refund(tripId: string, amountCents: number, key: string, tx?: Tx): Promise<void> {
  const q = tx ?? sql;
  const [sums] = await q`select
      coalesce(sum(amount_cents) filter (where kind in ('fare','tip','cancellation') and status = 'succeeded'), 0)::int as paid,
      coalesce(-sum(amount_cents) filter (where kind = 'refund' and status = 'succeeded'), 0)::int as refunded
    from charges where trip_id = ${tripId}`;
  if (amountCents <= 0 || amountCents > sums.paid - sums.refunded) throw fail(400, "Refund is more than what was paid", "invalid");
  const [fareCharge] = await q`select * from charges where trip_id = ${tripId} and kind in ('fare','cancellation') and status = 'succeeded' order by created_at limit 1`;
  let ref = "dev_refund";
  const s = stripe();
  if (fareCharge?.provider_ref?.startsWith("pi_") && s) {
    const r = await s.refunds.create({ payment_intent: fareCharge.provider_ref, amount: amountCents }, { idempotencyKey: key });
    ref = r.id;
  } else if (fareCharge?.provider_ref === "cash") {
    ref = "cash_refund_manual";
  }
  await q`insert into charges (trip_id, user_id, kind, amount_cents, currency, status, provider_ref, idempotency_key)
    select ${tripId}, rider_id, 'refund', ${-amountCents}, currency, 'succeeded', ${ref}, ${key} from trips where id = ${tripId}
    on conflict (idempotency_key) do nothing`;
}

/** Stripe Checkout in setup mode: Stripe hosts the card form; the webhook saves the card. */
export async function setupCheckoutUrl(user: { id: string; phone: string; email: string | null; name: string | null }): Promise<string> {
  const s = stripe();
  if (!s) throw fail(503, "Card payments are not set up yet.", "payments_unconfigured");
  const [existing] = await sql`select provider_customer_id from payment_methods where user_id = ${user.id} and provider = 'stripe' and provider_customer_id is not null limit 1`;
  const customer = existing?.provider_customer_id ??
    (await s.customers.create({ phone: user.phone, email: user.email ?? undefined, name: user.name ?? undefined, metadata: { user_id: user.id } })).id;
  const base = process.env.APP_URL || "http://localhost:3000";
  const session = await s.checkout.sessions.create({
    mode: "setup",
    customer,
    currency: "usd",
    success_url: `${base}/ride/wallet?added=1`,
    cancel_url: `${base}/ride/wallet`,
    metadata: { user_id: user.id },
  });
  return session.url!;
}

/** Called from the webhook when a setup Checkout completes. Idempotent per payment method. */
export async function saveStripeCard(userId: string, customerId: string, setupIntentId: string) {
  const s = stripe()!;
  const si = await s.setupIntents.retrieve(setupIntentId, { expand: ["payment_method"] });
  const pm = si.payment_method as Stripe.PaymentMethod | null;
  if (!pm?.card) return;
  const [dup] = await sql`select id from payment_methods where provider_pm_id = ${pm.id}`;
  if (dup) return;
  await sql.begin(async (tx) => {
    const [{ n }] = await tx`select count(*)::int as n from payment_methods where user_id = ${userId} and is_default`;
    await tx`insert into payment_methods (user_id, kind, provider, provider_customer_id, provider_pm_id, brand, last4, exp_month, exp_year, is_default)
      values (${userId}, 'card', 'stripe', ${customerId}, ${pm.id}, ${pm.card!.brand}, ${pm.card!.last4}, ${pm.card!.exp_month}, ${pm.card!.exp_year}, ${n === 0})`;
  });
}
