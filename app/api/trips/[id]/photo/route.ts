import { sql } from "@/lib/db";
import { route, fail, type Ctx } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadTripFor } from "@/lib/trips";

/** The other party's photo on a trip you're part of: rider sees driver, driver sees rider. */
export const GET = route(async (_req, ctx: Ctx<{ id: string }>) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const t = await loadTripFor(user, id);
  const other = t.rider_id === user.id ? t.driver_id : t.driver_id === user.id ? t.rider_id : null;
  if (!other) throw fail(404, "No photo", "not_found");
  const [a] = await sql`select mime, bytes from avatars where user_id = ${other}`;
  if (!a) throw fail(404, "No photo", "not_found");
  return new Response(new Uint8Array(a.bytes), { headers: { "Content-Type": a.mime, "Cache-Control": "private, max-age=300" } });
});
