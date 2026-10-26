import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, fail } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { defaultCity } from "@/lib/trips";

export const POST = route(async (req) => {
  const user = await requireUser();
  const year = new Date().getFullYear();
  const i = await body(req, z.object({
    name: z.string().trim().min(2).max(60),
    licenceNo: z.string().trim().min(4).max(30),
    licenceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker"),
    vehicle: z.object({
      make: z.string().trim().min(1).max(30), model: z.string().trim().min(1).max(30), colour: z.string().trim().min(1).max(20),
      plate: z.string().trim().min(2).max(12), year: z.number().int().min(year - 20).max(year + 1), seats: z.number().int().min(2).max(8),
    }),
  }));
  if (new Date(i.licenceExpiry) <= new Date()) throw fail(400, "That licence has expired.", "licence_expired");
  const [exists] = await sql`select 1 from driver_profiles where user_id = ${user.id}`;
  if (exists) throw fail(409, "You've already applied.", "exists");
  const city = await defaultCity();
  await sql.begin(async (tx) => {
    await tx`update users set name = ${i.name}, updated_at = now() where id = ${user.id}`;
    await tx`insert into driver_profiles (user_id, city_id, licence_no, licence_expiry) values (${user.id}, ${city.id}, ${i.licenceNo}, ${i.licenceExpiry})`;
    await tx`insert into vehicles (driver_id, make, model, colour, plate, year, seats)
      values (${user.id}, ${i.vehicle.make}, ${i.vehicle.model}, ${i.vehicle.colour}, ${i.vehicle.plate.toUpperCase()}, ${i.vehicle.year}, ${i.vehicle.seats})`;
  });
  return { ok: true };
});
