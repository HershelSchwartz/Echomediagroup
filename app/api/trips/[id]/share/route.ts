import { route, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { shareLink } from "@/lib/trips";

export const POST = route(async (_req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return { url: await shareLink(user, id) };
});
