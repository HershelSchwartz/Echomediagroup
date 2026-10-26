import { route, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { markArrived, loadTripFor, tripView } from "@/lib/trips";

export const POST = route(async (_req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await markArrived(user, id);
  return { trip: await tripView(await loadTripFor(user, id), user) };
});
