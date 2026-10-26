import { sql, type Tx } from "./db";
import { fail, isUnique } from "./http";
import { haversine } from "./geo";
import { estimateRoute } from "./maps";

export const OFFER_SECONDS = 15;
export const MAX_OFFERS = 6;
export const MATCH_TIMEOUT_S = 180;
export const RADIUS_M = 8000;
export const PING_FRESH_S = 30;

const LIVE = ["accepted", "arrived", "in_progress"];

/**
 * Offers a `matching` trip to the nearest eligible driver, one at a time.
 * Safe to call concurrently: the trip row is locked, and the partial unique indexes
 * (one pending offer per trip, one per driver) settle any race.
 */
export async function dispatchNext(tx: Tx, tripId: string): Promise<void> {
  const [trip] = await tx`select t.*, p.seats, p.min_vehicle_year from trips t join products p on p.id = t.product_id
    where t.id = ${tripId} for update of t`;
  if (!trip || trip.status !== "matching") return;

  const [{ pending, total }] = await tx`select
      count(*) filter (where response = 'pending' and expires_at > now())::int as pending,
      count(*)::int as total
    from dispatch_offers where trip_id = ${tripId}`;
  if (pending > 0) return;

  const age = (Date.now() - new Date(trip.requested_at).getTime()) / 1000;
  if (total >= MAX_OFFERS || age > MATCH_TIMEOUT_S) {
    await tx`update trips set status = 'no_drivers', updated_at = now() where id = ${tripId}`;
    return;
  }

  // Rough box first (index-friendly), exact distance after.
  const dLat = RADIUS_M / 111_000;
  const dLng = RADIUS_M / (111_000 * Math.cos((trip.pickup_lat * Math.PI) / 180));
  type Candidate = { user_id: string; last_lat: number; last_lng: number; dest_filter_lat: number | null; dest_filter_lng: number; vehicle_id: string };
  const candidates = (await tx`select dp.user_id, dp.last_lat, dp.last_lng, dp.dest_filter_lat, dp.dest_filter_lng, v.id as vehicle_id
    from driver_profiles dp
    join lateral (
      select id from vehicles v where v.driver_id = dp.user_id and v.active
        and v.seats >= ${trip.seats} and v.year >= ${trip.min_vehicle_year}
      order by v.created_at limit 1
    ) v on true
    where dp.city_id = ${trip.city_id} and dp.status = 'approved' and dp.online
      and dp.last_seen_at > now() - ${PING_FRESH_S + " seconds"}::interval
      and dp.user_id <> ${trip.rider_id}
      and dp.last_lat between ${trip.pickup_lat - dLat} and ${trip.pickup_lat + dLat}
      and dp.last_lng between ${trip.pickup_lng - dLng} and ${trip.pickup_lng + dLng}
      and not exists (select 1 from trips t2 where t2.driver_id = dp.user_id and t2.status in ${tx(LIVE)})
      and not exists (select 1 from dispatch_offers o where o.driver_id = dp.user_id and o.response = 'pending' and o.expires_at > now())
      and not exists (select 1 from dispatch_offers o where o.driver_id = dp.user_id and o.trip_id = ${tripId})`) as unknown as Candidate[];

  const pickup = { lat: trip.pickup_lat, lng: trip.pickup_lng };
  const dropoff = { lat: trip.dropoff_lat, lng: trip.dropoff_lng };
  const ranked = candidates
    .map((c) => ({ ...c, d: haversine(pickup, { lat: c.last_lat, lng: c.last_lng }) }))
    .filter((c) => c.d <= RADIUS_M)
    // Destination filter: only trips that end closer to where the driver wants to go.
    .filter((c) => {
      if (c.dest_filter_lat == null) return true;
      const home = { lat: c.dest_filter_lat, lng: c.dest_filter_lng };
      return haversine(dropoff, home) < haversine({ lat: c.last_lat, lng: c.last_lng }, home);
    })
    .sort((a, b) => a.d - b.d);

  // Overdue offers still count against the one-pending-offer indexes until marked expired,
  // for this trip and for the candidates. Their trips re-dispatch on their next poll.
  await tx`update dispatch_offers set response = 'expired', responded_at = now()
    where response = 'pending' and expires_at <= now()`;

  for (const c of ranked) {
    const rows = await tx`insert into dispatch_offers (trip_id, driver_id, expires_at)
      values (${tripId}, ${c.user_id}, now() + ${OFFER_SECONDS + " seconds"}::interval)
      on conflict do nothing returning id`;
    if (rows.length) return;
  }
  // Nobody free right now: the next poll tries again until the timeout.
}

/** Expires overdue offers and moves the trip along. Called on every rider and driver poll. */
export async function advanceDispatch(tripId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`update dispatch_offers set response = 'expired', responded_at = now()
      where trip_id = ${tripId} and response = 'pending' and expires_at <= now()`;
    await dispatchNext(tx, tripId);
  });
}

/** Expires the driver's own overdue offer (so their state is fresh) and re-dispatches that trip. */
export async function expireDriverOffers(driverId: string): Promise<void> {
  const expired = await sql`update dispatch_offers set response = 'expired', responded_at = now()
    where driver_id = ${driverId} and response = 'pending' and expires_at <= now() returning trip_id`;
  for (const r of expired) await advanceDispatch(r.trip_id);
}

export async function acceptOffer(driverId: string, offerId: string) {
  try {
    return await sql.begin(async (tx) => {
      const [offer] = await tx`select * from dispatch_offers where id = ${offerId} and driver_id = ${driverId} for update`;
      if (!offer) throw fail(404, "Offer not found", "not_found");
      if (offer.response !== "pending" || new Date(offer.expires_at) <= new Date()) {
        throw fail(409, "This request is no longer available.", "offer_gone");
      }
      const [driver] = await tx`select last_lat, last_lng from driver_profiles where user_id = ${driverId}`;
      const [trip0] = await tx`select pickup_lat, pickup_lng from trips where id = ${offer.trip_id}`;
      const eta = estimateRoute([
        { lat: driver.last_lat, lng: driver.last_lng },
        { lat: trip0.pickup_lat, lng: trip0.pickup_lng },
      ]).durationS;
      const [v] = await tx`select id from vehicles where driver_id = ${driverId} and active order by created_at limit 1`;
      const [trip] = await tx`update trips set driver_id = ${driverId}, vehicle_id = ${v?.id ?? null}, status = 'accepted',
          accepted_at = now(), pickup_eta_at = now() + ${Math.max(60, eta) + " seconds"}::interval, updated_at = now()
        where id = ${offer.trip_id} and status = 'matching' returning *`;
      if (!trip) {
        await tx`update dispatch_offers set response = 'lost', responded_at = now() where id = ${offerId}`;
        throw fail(409, "Another driver got this one, or the rider cancelled.", "offer_lost");
      }
      await tx`update dispatch_offers set response = 'accepted', responded_at = now() where id = ${offerId}`;
      return trip;
    });
  } catch (e) {
    if (isUnique(e, "one_live_trip_per_driver")) throw fail(409, "Finish your current trip first.", "driver_busy");
    throw e;
  }
}

export async function declineOffer(driverId: string, offerId: string) {
  await sql.begin(async (tx) => {
    const [offer] = await tx`update dispatch_offers set response = 'declined', responded_at = now()
      where id = ${offerId} and driver_id = ${driverId} and response = 'pending' returning trip_id`;
    if (offer) await dispatchNext(tx, offer.trip_id);
  });
}
