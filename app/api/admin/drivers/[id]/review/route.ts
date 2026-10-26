import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail, type Ctx } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { sendSms } from "@/lib/notify";
import { brand } from "@/lib/brand";

export const POST = route(async (req, ctx: Ctx<{ id: string }>) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const i = await body(req, z.object({ status: z.enum(["approved", "rejected", "suspended"]), note: z.string().max(300).optional() }));
  const [d] = await sql`update driver_profiles set status = ${i.status}, review_note = ${i.note ?? null},
      online = case when ${i.status} = 'approved' then online else false end, updated_at = now()
    where user_id = ${id} returning user_id`;
  if (!d) throw fail(404, "Driver not found", "not_found");
  if (i.status === "approved") await sql`update driver_documents set status = 'approved' where driver_id = ${id} and status = 'pending'`;
  const [u] = await sql`select phone from users where id = ${id}`;
  const text = i.status === "approved" ? `${brand.name}: you're approved to drive. Open the app and tap Go.`
    : `${brand.name}: there's an update on your driver account. Open the app for details.`;
  if (u?.phone && !u.phone.startsWith("deleted:")) await sendSms(u.phone, text);
  return { ok: true };
});
