import { z } from "zod";
import { route, body, zPlace, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { changeDestination, loadTripFor, tripView } from "@/lib/trips";

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { dropoff } = await body(req, z.object({ dropoff: zPlace }));
  await changeDestination(user, id, dropoff);
  return { trip: await tripView(await loadTripFor(user, id), user) };
});
