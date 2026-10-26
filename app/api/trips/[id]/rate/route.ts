import { z } from "zod";
import { route, body, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateTrip } from "@/lib/trips";

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const i = await body(req, z.object({
    stars: z.number().int().min(1).max(5),
    tags: z.array(z.string().max(30)).max(6).default([]),
    comment: z.string().trim().max(500).optional(),
  }));
  await rateTrip(user, id, i.stars, i.tags, i.comment || undefined);
  return { ok: true };
});
