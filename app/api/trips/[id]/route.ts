import { route, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadTripFor, tripView } from "@/lib/trips";

export const GET = route(async (_req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return { trip: await tripView(await loadTripFor(user, id), user) };
});
