import { sql } from "@/lib/db";
import { route } from "@/lib/http";
import { requireDriver } from "@/lib/driver";
import { expireDriverOffers, advanceDispatch } from "@/lib/dispatch";
import { currentTripFor } from "@/lib/trips";
import { estimateRoute } from "@/lib/maps";
import { driverEarnings } from "@/lib/pricing";

export const GET = route(async () => {
  const { user, profile } = await requireDriver();
  await expireDriverOffers(user.id);
  // Keep requests moving even if no rider is polling: nudge matching trips nearby.
  if (profile.online && profile.status === "approved") {
    const waiting = await sql`select id from trips where city_id = ${profile.city_id} and status = 'matching'
      and not exists (select 1 from dispatch_offers o where o.trip_id = trips.id and o.response = 'pending' and o.expires_at > now())
      order by requested_at limit 3`;
    for (const w of waiting) await advanceDispatch(w.id);
  }
  const [offer] = await sql`select o.id, o.expires_at, t.pickup_lat, t.pickup_lng, t.pickup_address, t.dropoff_lat, t.dropoff_lng,
      t.dropoff_address, t.est_distance_m, t.est_duration_s, t.quoted_fare_cents, t.currency, p.name as product_name, p.booking_fee_cents,
      (select count(*) from trip_stops s where s.trip_id = t.id)::int as stops
    from dispatch_offers o join trips t on t.id = o.trip_id join products p on p.id = t.product_id
    where o.driver_id = ${user.id} and o.response = 'pending' and o.expires_at > now() limit 1`;
  const [vehicle] = await sql`select make, model, colour, plate, year, seats from vehicles where driver_id = ${user.id} and active limit 1`;
  const [today] = await sql`select coalesce(sum(final_fare_cents), 0)::int as fares, coalesce(sum(wait_fee_cents), 0)::int as waits,
      coalesce(sum(tip_cents), 0)::int as tips, coalesce(sum(p.booking_fee_cents), 0)::int as fees, count(*)::int as trips
    from trips t join products p on p.id = t.product_id
    where t.driver_id = ${user.id} and t.status = 'completed' and t.completed_at > date_trunc('day', now())`;
  const trip = await currentTripFor(user, "driver");
  const here = profile.last_lat != null ? { lat: profile.last_lat, lng: profile.last_lng } : null;
  return {
    profile: {
      status: profile.status, online: profile.online, reviewNote: profile.review_note,
      position: here, destination: profile.dest_filter_lat != null ? { lat: profile.dest_filter_lat, lng: profile.dest_filter_lng, label: profile.dest_filter_label } : null,
    },
    vehicle: vehicle ?? null,
    today: { earningsCents: driverEarnings(today.fares, today.waits, today.tips, today.fees), trips: today.trips },
    offer: offer
      ? {
          id: offer.id,
          expiresAt: offer.expires_at,
          productName: offer.product_name,
          pickup: { lat: offer.pickup_lat, lng: offer.pickup_lng, address: offer.pickup_address },
          dropoff: { lat: offer.dropoff_lat, lng: offer.dropoff_lng, address: offer.dropoff_address },
          stops: offer.stops,
          toPickupS: here ? estimateRoute([here, { lat: offer.pickup_lat, lng: offer.pickup_lng }]).durationS : null,
          toPickupM: here ? estimateRoute([here, { lat: offer.pickup_lat, lng: offer.pickup_lng }]).distanceM : null,
          tripS: offer.est_duration_s,
          tripM: offer.est_distance_m,
          earningsCents: driverEarnings(offer.quoted_fare_cents, 0, 0, offer.booking_fee_cents),
          currency: offer.currency,
        }
      : null,
    trip,
  };
});
