import { sql } from "@/lib/db";
import { route, fail } from "@/lib/http";
import { requireDriver } from "@/lib/driver";

const KINDS = ["licence", "insurance", "vehicle_photo", "profile_photo"];
const TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX = 5 * 1024 * 1024;

export const GET = route(async () => {
  const { user } = await requireDriver();
  return { documents: await sql`select id, kind, filename, status, created_at from driver_documents where driver_id = ${user.id} order by created_at` };
});

export const POST = route(async (req) => {
  const { user } = await requireDriver();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");
  if (!KINDS.includes(kind)) throw fail(400, "Pick which document this is.", "invalid");
  if (!(file instanceof File)) throw fail(400, "Choose a file to upload.", "invalid");
  if (file.size > MAX) throw fail(413, "That file is over 5 MB. Try a smaller photo.", "too_large");
  if (!TYPES.includes(file.type)) throw fail(415, "Upload a JPEG, PNG or PDF.", "bad_type");
  const bytes = Buffer.from(await file.arrayBuffer());
  await sql.begin(async (tx) => {
    await tx`delete from driver_documents where driver_id = ${user.id} and kind = ${kind} and status <> 'approved'`;
    await tx`insert into driver_documents (driver_id, kind, filename, mime, bytes)
      values (${user.id}, ${kind}, ${file.name.slice(0, 100)}, ${file.type}, ${bytes})`;
  });
  return { ok: true };
});
