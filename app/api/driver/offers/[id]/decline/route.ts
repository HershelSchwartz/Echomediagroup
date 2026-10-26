import { route, type Ctx } from "@/lib/http";
import { requireDriver } from "@/lib/driver";
import { declineOffer } from "@/lib/dispatch";

export const POST = route(async (_req, ctx: Ctx<{ id: string }>) => {
  const { user } = await requireDriver();
  const { id } = await ctx.params;
  await declineOffer(user.id, id);
  return { ok: true };
});
