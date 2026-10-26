import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail, type Ctx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

const cents = z.number().int().min(0).max(100000);
const mins = z.number().int().min(0).max(60);

export const PATCH = route(async (req, ctx: Ctx<{ id: string }>) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const i = await body(req, z.object({
    base_cents: cents, per_km_cents: cents, per_min_cents: cents, min_fare_cents: cents, booking_fee_cents: cents,
    wait_grace_min: mins, wait_per_min_cents: cents, cancel_free_min: mins, cancel_fee_cents: cents, no_show_min: mins,
    active: z.boolean(),
  }).partial());
  if (!Object.keys(i).length) throw fail(400, "Nothing to change", "invalid");
  const [p] = await sql`update products set ${sql(i)}, updated_at = now() where id = ${id} returning id`;
  if (!p) throw fail(404, "Product not found", "not_found");
  return { ok: true };
});
