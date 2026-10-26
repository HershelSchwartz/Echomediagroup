import { z } from "zod";
import { route, body, fail, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { tipTrip } from "@/lib/trips";

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { cents } = await body(req, z.object({ cents: z.number().int() }));
  const c = await tipTrip(user, id, cents);
  if (c.status === "failed") throw fail(402, "Your card was declined, so the tip didn't go through.", "card_declined");
  return { charge: c };
});
