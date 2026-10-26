import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail, type Ctx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const PATCH = route(async (req, ctx: Ctx<{ id: string }>) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const { surge } = await body(req, z.object({ surge: z.number().min(1).max(3) }));
  const [c] = await sql`update cities set surge_multiplier = ${surge}, updated_at = now() where id = ${id} returning id`;
  if (!c) throw fail(404, "City not found", "not_found");
  return { ok: true };
});
