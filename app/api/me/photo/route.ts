import { sql } from "@/lib/db";
import { route, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { saveAvatar } from "@/lib/avatars";

export const POST = route(async (req) => {
  const user = await requireUser();
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) throw fail(400, "Choose a photo.", "invalid");
  await saveAvatar(user.id, file);
  return { ok: true };
});

export const GET = route(async () => {
  const user = await requireUser();
  const [a] = await sql`select mime, bytes from avatars where user_id = ${user.id}`;
  if (!a) throw fail(404, "No photo", "not_found");
  return new Response(new Uint8Array(a.bytes), { headers: { "Content-Type": a.mime, "Cache-Control": "private, no-store" } });
});

export const DELETE = route(async () => {
  const user = await requireUser();
  await sql`delete from avatars where user_id = ${user.id}`;
  return { ok: true };
});
