import { z } from "zod";
import { route, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { cancelTrip, loadTripFor, tripView } from "@/lib/trips";

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const i = z.object({ reason: z.string().max(60).optional(), noShow: z.boolean().optional() }).parse(await req.json().catch(() => ({})));
  await cancelTrip(user, id, i);
  return { trip: await tripView(await loadTripFor(user, id), user) };
});
