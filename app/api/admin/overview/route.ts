import { sql } from "@/lib/db";
import { route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async () => {
  await requireAdmin();
  const [live, drivers, tickets, [today], products, [city]] = await Promise.all([
    sql`select t.id, t.status, t.pickup_address, t.dropoff_address, t.requested_at, t.quoted_fare_cents, t.currency,
        r.name as rider_name, d.name as driver_name, p.name as product_name
      from trips t join users r on r.id = t.rider_id left join users d on d.id = t.driver_id join products p on p.id = t.product_id
      where t.status in ('matching','accepted','arrived','in_progress') order by t.requested_at desc limit 100`,
    sql`select u.id, u.name, u.phone, dp.status, dp.online, dp.last_seen_at, dp.licence_no, dp.licence_expiry, dp.review_note,
        case when u.rating_count > 0 then round(u.rating_sum::numeric / u.rating_count, 2)::float end as rating,
        v.make, v.model, v.year, v.plate, v.seats,
        coalesce((select json_agg(json_build_object('id', d.id, 'kind', d.kind, 'filename', d.filename, 'status', d.status) order by d.created_at)
          from driver_documents d where d.driver_id = u.id), '[]') as documents
      from driver_profiles dp join users u on u.id = dp.user_id
      left join lateral (select * from vehicles v where v.driver_id = u.id and v.active order by created_at limit 1) v on true
      where u.deleted_at is null
      order by (dp.status = 'pending') desc, u.name limit 200`,
    sql`select s.id, s.trip_id, s.category, s.body, s.status, s.created_at, u.name as user_name,
        t.final_fare_cents, t.cancel_fee_cents, t.currency
      from support_tickets s join users u on u.id = s.user_id left join trips t on t.id = s.trip_id
      where s.status = 'open' order by s.created_at limit 100`,
    sql`select count(*) filter (where status = 'completed')::int as completed,
        count(*) filter (where status like 'cancelled%')::int as cancelled,
        count(*) filter (where status = 'no_drivers')::int as unmatched,
        coalesce(sum(final_fare_cents) filter (where status = 'completed'), 0)::int as gross_cents
      from trips where requested_at > date_trunc('day', now())`,
    sql`select id, code, name, seats, base_cents, per_km_cents, per_min_cents, min_fare_cents, booking_fee_cents,
        wait_grace_min, wait_per_min_cents, cancel_free_min, cancel_fee_cents, no_show_min, active from products order by sort`,
    sql`select id, name, surge_multiplier, currency from cities order by created_at limit 1`,
  ]);
  return { live, drivers, tickets, today, products, city };
});
