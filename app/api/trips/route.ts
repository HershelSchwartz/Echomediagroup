import { z } from "zod";
import { sql } from "@/lib/db";
import { route, body, zPlace, zUuid } from "@/lib/http";
import { requireUser, normalizePhone } from "@/lib/auth";
import { requestTrip, tripView, loadTripFor } from "@/lib/trips";

export const GET = route(async () => {
  const user = await requireUser();
  const rows = await sql`select t.id, t.status, t.pickup_address, t.dropoff_address, t.requested_at, t.completed_at,
      t.final_fare_cents, t.quoted_fare_cents, t.cancel_fee_cents, t.tip_cents, t.currency, p.name as product_name,
      case when t.rider_id = ${user.id} then 'rider' else 'driver' end as role
    from trips t join products p on p.id = t.product_id
    where t.rider_id = ${user.id} or t.driver_id = ${user.id}
    order by t.requested_at desc limit 50`;
  return { trips: rows };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const i = await body(req, z.object({
    productId: zUuid,
    pickup: zPlace,
    dropoff: zPlace,
    stops: z.array(zPlace).max(2).default([]),
    quotedFareCents: z.number().int().positive(),
    paymentMethodId: zUuid.optional(),
    guest: z.object({ name: z.string().trim().min(1).max(60), phone: z.string().min(7).max(20) }).optional(),
  }));
  if (i.guest) {
    const p = normalizePhone(i.guest.phone);
    if (!p) return Response.json({ error: "Enter the rider's mobile number with country code." }, { status: 400 });
    i.guest.phone = p;
  }
  const trip = await requestTrip(user, i);
  return { trip: await tripView(await loadTripFor(user, trip.id), user) };
});
