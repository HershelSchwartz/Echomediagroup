import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, zPlace, zUuid } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  const user = await requireUser();
  return { places: await sql`select id, label, address, lat, lng from saved_places where user_id = ${user.id} order by created_at` };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const p = await body(req, zPlace.extend({ label: z.string().trim().min(1).max(30) }));
  const [{ n }] = await sql`select count(*)::int as n from saved_places where user_id = ${user.id}`;
  if (n >= 20) return Response.json({ error: "You can save up to 20 places." }, { status: 400 });
  const [row] = await sql`insert into saved_places (user_id, label, address, lat, lng)
    values (${user.id}, ${p.label}, ${p.address}, ${p.lat}, ${p.lng}) returning id, label, address, lat, lng`;
  return { place: row };
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const id = zUuid.parse(new URL(req.url).searchParams.get("id"));
  await sql`delete from saved_places where id = ${id} and user_id = ${user.id}`;
  return { ok: true };
});
