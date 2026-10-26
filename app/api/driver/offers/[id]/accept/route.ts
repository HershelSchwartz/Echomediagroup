import { route, type Ctx } from "@/lib/http";
import { requireDriver } from "@/lib/driver";
import { acceptOffer } from "@/lib/dispatch";

export const POST = route(async (_req, ctx: Ctx<{ id: string }>) => {
  const { user } = await requireDriver({ approved: true });
  const { id } = await ctx.params;
  const trip = await acceptOffer(user.id, id);
  return { tripId: trip.id };
});
