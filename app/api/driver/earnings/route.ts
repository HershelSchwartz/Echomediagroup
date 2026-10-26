import { sql } from "@/lib/db";
import { route } from "@/lib/http";
import { requireDriver } from "@/lib/driver";
import { driverEarnings } from "@/lib/pricing";

export const GET = route(async () => {
  const { user, profile } = await requireDriver();
  const [city] = await sql`select timezone, currency from cities where id = ${profile.city_id}`;
  const trips = await sql`select t.id, t.completed_at, t.pickup_address, t.dropoff_address, t.final_fare_cents, t.wait_fee_cents, t.tip_cents,
      p.booking_fee_cents, p.name as product_name
    from trips t join products p on p.id = t.product_id
    where t.driver_id = ${user.id} and t.status = 'completed' and t.completed_at > now() - interval '7 days'
    order by t.completed_at desc`;
  const rows = trips.map((t) => ({
    id: t.id, completedAt: t.completed_at, from: t.pickup_address, to: t.dropoff_address, product: t.product_name,
    earningsCents: driverEarnings(t.final_fare_cents, t.wait_fee_cents, t.tip_cents, t.booking_fee_cents), tipCents: t.tip_cents,
  }));
  const byDay = new Map<string, { cents: number; trips: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toLocaleDateString("en-CA", { timeZone: city.timezone });
    byDay.set(d, { cents: 0, trips: 0 });
  }
  for (const r of rows) {
    const d = new Date(r.completedAt).toLocaleDateString("en-CA", { timeZone: city.timezone });
    const b = byDay.get(d);
    if (b) { b.cents += r.earningsCents; b.trips++; }
  }
  const payouts = await sql`select period_start, period_end, amount_cents, status from payouts where driver_id = ${user.id} order by period_end desc limit 8`;
  return {
    currency: city.currency,
    totalCents: rows.reduce((s, r) => s + r.earningsCents, 0),
    days: [...byDay].map(([date, v]) => ({ date, ...v })),
    trips: rows,
    payouts,
  };
});
