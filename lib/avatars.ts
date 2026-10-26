import { sql } from "./db";
import { fail } from "./http";

export const AVATAR_TYPES = ["image/jpeg", "image/png"];
export const AVATAR_MAX = 2 * 1024 * 1024;

export async function saveAvatar(userId: string, file: File) {
  if (!AVATAR_TYPES.includes(file.type)) throw fail(415, "Use a JPEG or PNG photo.", "bad_type");
  if (file.size > AVATAR_MAX) throw fail(413, "That photo is over 2 MB. Try a smaller one.", "too_large");
  const bytes = Buffer.from(await file.arrayBuffer());
  await sql`insert into avatars (user_id, mime, bytes) values (${userId}, ${file.type}, ${bytes})
    on conflict (user_id) do update set mime = excluded.mime, bytes = excluded.bytes, updated_at = now()`;
}

export async function hasAvatar(userId: string | null) {
  if (!userId) return false;
  const [a] = await sql`select 1 from avatars where user_id = ${userId}`;
  return !!a;
}
