import { route, fail, type Ctx } from "@/lib/http";
import { sharedTrip } from "@/lib/trips";

export const GET = route(async (_req, ctx: Ctx<{ token: string }>) => {
  const { token } = await ctx.params;
  const t = await sharedTrip(token);
  if (!t) throw fail(404, "This link has expired.", "not_found");
  return { trip: t };
});
