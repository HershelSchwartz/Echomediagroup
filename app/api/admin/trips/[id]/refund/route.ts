import { z } from "zod";
import { route, body, type Ctx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { refund } from "@/lib/payments";

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const { cents, key } = await body(req, z.object({ cents: z.number().int().positive(), key: z.string().min(8).max(80) }));
  await refund(id, cents, `refund:${id}:${key}`);
  return { ok: true };
});
