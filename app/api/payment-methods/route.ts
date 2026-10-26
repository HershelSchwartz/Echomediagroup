import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail, zUuid } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { setupCheckoutUrl, stripeMode } from "@/lib/payments";

export const GET = route(async () => {
  const user = await requireUser();
  const methods = await sql`select id, kind, provider, brand, last4, exp_month, exp_year, is_default
    from payment_methods where user_id = ${user.id} order by created_at`;
  const unpaid = await sql`select c.id, c.trip_id, c.kind, c.amount_cents, c.currency, c.failure_reason, c.created_at
    from charges c where c.user_id = ${user.id} and c.status = 'failed' and c.kind <> 'tip'
      and not exists (select 1 from charges c2 where c2.trip_id = c.trip_id and c2.kind = c.kind and c2.status = 'succeeded')`;
  return { methods, unpaid, stripe: stripeMode() };
});

/**
 * add: 'card' starts Stripe Checkout (setup mode) and returns its URL. Without Stripe keys,
 * in development only, 'devCard' adds a test card ('4242' works, '0002' declines).
 * 'cash' adds cash. 'default' switches the default method.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const i = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("card") }),
    z.object({ action: z.literal("devCard"), last4: z.enum(["4242", "0002"]) }),
    z.object({ action: z.literal("cash") }),
    z.object({ action: z.literal("default"), id: zUuid }),
    z.object({ action: z.literal("remove"), id: zUuid }),
  ]));
  if (i.action === "card") return { url: await setupCheckoutUrl(user) };
  if (i.action === "devCard" || i.action === "cash") {
    if (i.action === "devCard" && (stripeMode() || process.env.NODE_ENV === "production")) throw fail(400, "Test cards are only for development.", "invalid");
    await sql.begin(async (tx) => {
      const [{ n }] = await tx`select count(*)::int as n from payment_methods where user_id = ${user.id} and is_default`;
      if (i.action === "cash") {
        const [has] = await tx`select id from payment_methods where user_id = ${user.id} and kind = 'cash'`;
        if (has) return;
        await tx`insert into payment_methods (user_id, kind, provider, is_default) values (${user.id}, 'cash', 'none', ${n === 0})`;
      } else {
        await tx`insert into payment_methods (user_id, kind, provider, brand, last4, exp_month, exp_year, is_default)
          values (${user.id}, 'card', 'dev', 'visa', ${i.last4}, 12, 2030, ${n === 0})`;
      }
    });
    return { ok: true };
  }
  if (i.action === "default") {
    await sql.begin(async (tx) => {
      const [pm] = await tx`select id from payment_methods where id = ${i.id} and user_id = ${user.id}`;
      if (!pm) throw fail(404, "Payment method not found", "not_found");
      await tx`update payment_methods set is_default = false where user_id = ${user.id} and is_default`;
      await tx`update payment_methods set is_default = true where id = ${i.id}`;
    });
    return { ok: true };
  }
  const [live] = await sql`select id from trips where payment_method_id = ${i.id} and status in ('matching','accepted','arrived','in_progress')`;
  if (live) throw fail(409, "This method is paying for your current ride.", "in_use");
  await sql.begin(async (tx) => {
    const [pm] = await tx`delete from payment_methods where id = ${i.id} and user_id = ${user.id} returning is_default`;
    if (pm?.is_default) {
      await tx`update payment_methods set is_default = true where id = (select id from payment_methods where user_id = ${user.id} order by created_at limit 1)`;
    }
  });
  return { ok: true };
});
