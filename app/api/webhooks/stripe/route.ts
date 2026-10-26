import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { isUnique } from "@/lib/http";
import { stripe, saveStripeCard } from "@/lib/payments";

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new Response("not configured", { status: 503 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(raw, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }
  try {
    await sql`insert into webhook_events (id, provider, type) values (${event.id}, 'stripe', ${event.type})`;
  } catch (e) {
    if (isUnique(e)) return new Response("duplicate", { status: 200 });
    throw e;
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object;
        if (cs.mode === "setup" && cs.setup_intent && cs.metadata?.user_id && typeof cs.customer === "string") {
          await saveStripeCard(cs.metadata.user_id, cs.customer, String(cs.setup_intent));
        }
        break;
      }
      case "payment_intent.succeeded":
        await sql`update charges set status = 'succeeded', failure_reason = null, updated_at = now()
          where provider_ref = ${event.data.object.id} and status <> 'succeeded'`;
        break;
      case "payment_intent.payment_failed":
        await sql`update charges set status = 'failed', failure_reason = ${event.data.object.last_payment_error?.code ?? "failed"}, updated_at = now()
          where provider_ref = ${event.data.object.id} and status = 'pending'`;
        break;
    }
  } catch (e) {
    // Let Stripe retry: forget the event id so the retry is processed.
    await sql`delete from webhook_events where id = ${event.id}`;
    console.error("stripe webhook", e);
    return new Response("error", { status: 500 });
  }
  return new Response("ok");
}
