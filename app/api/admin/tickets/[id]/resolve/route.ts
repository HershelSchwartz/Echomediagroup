import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail, type Ctx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { refund } from "@/lib/payments";
import { sendEmail } from "@/lib/notify";
import { money } from "@/lib/money";
import { brand } from "@/lib/brand";

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const i = await body(req, z.object({ resolution: z.string().trim().min(3).max(1000), refundCents: z.number().int().min(0).default(0) }));
  const [t] = await sql`select s.*, u.email, tr.currency from support_tickets s join users u on u.id = s.user_id
    left join trips tr on tr.id = s.trip_id where s.id = ${id}`;
  if (!t) throw fail(404, "Ticket not found", "not_found");
  if (t.status === "resolved") throw fail(409, "Already resolved", "bad_state");
  if (i.refundCents > 0) {
    if (!t.trip_id) throw fail(400, "This ticket isn't about a trip, so there's nothing to refund.", "invalid");
    await refund(t.trip_id, i.refundCents, `ticket:${id}`);
  }
  await sql`update support_tickets set status = 'resolved', resolution = ${i.resolution}, refund_cents = ${i.refundCents}, updated_at = now() where id = ${id}`;
  if (t.email) {
    await sendEmail(t.email, `${brand.name}: we looked into your request`,
      [i.resolution, ...(i.refundCents ? ["", `Refund: ${money(i.refundCents, t.currency ?? "usd")} back to your payment method.`] : [])].join("\n"));
  }
  return { ok: true };
});
