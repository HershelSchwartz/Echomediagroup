import { randomBytes } from "node:crypto";
import { sql } from "./db";
import { fail, isUnique } from "./http";
import { inArea, haversine, type LatLng } from "./geo";
import { route, estimateRoute, describePoint } from "./maps";
import { fare, surge as surgeFor, waitFee, cancelFee, tipOptions, type PriceRule } from "./pricing";
import { dispatchNext, advanceDispatch } from "./dispatch";
import { charge } from "./payments";
import { sendEmail, sendSms } from "./notify";
import { money } from "./money";
import { brand } from "./brand";
import { firstName, type User } from "./auth";
import { hasAvatar } from "./avatars";

export const LIVE_STATUSES = ["matching", "accepted", "arrived", "in_progress"] as const;
export type Place = LatLng & { address: string };

export type City = {
  id: string; name: string; currency: string; timezone: string; surge_multiplier: string;
  min_lat: number; max_lat: number; min_lng: number; max_lng: number; center_lat: number; center_lng: number;
};

export async function defaultCity(): Promise<City> {
  const [c] = await sql`select * from cities order by created_at limit 1`;
  if (!c) throw fail(503, "No service area is set up yet.", "no_city");
  return c as unknown as City;
}

async function busyMultiplier(city: { id: string; surge_multiplier: string }) {
  const [{ open, idle }] = await sql`select
      (select count(*) from trips where city_id = ${city.id} and status = 'matching')::int as open,
      (select count(*) from driver_profiles dp where dp.city_id = ${city.id} and dp.online and dp.status = 'approved'
         and dp.last_seen_at > now() - interval '30 seconds'
         and not exists (select 1 from trips t where t.driver_id = dp.user_id and t.status in ('accepted','arrived','in_progress')))::int as idle`;
  return { surge: surgeFor(Number(city.surge_multiplier), open, idle), idle };
}

/** ETA (seconds) from the nearest idle driver able to take each product, or null if none. */
async function pickupEtas(cityId: string, pickup: LatLng) {
  const rows = await sql`select p.id as product_id, dp.last_lat, dp.last_lng
    from products p
    join driver_profiles dp on dp.city_id = p.city_id and dp.online and dp.status = 'approved'
      and dp.last_seen_at > now() - interval '30 seconds'
    join vehicles v on v.driver_id = dp.user_id and v.active and v.seats >= p.seats and v.year >= p.min_vehicle_year
    where p.city_id = ${cityId} and p.active
      and not exists (select 1 from trips t where t.driver_id = dp.user_id and t.status in ('accepted','arrived','in_progress'))`;
  const best = new Map<string, number>();
  for (const r of rows) {
    const s = estimateRoute([{ lat: r.last_lat, lng: r.last_lng }, pickup]).durationS;
    if (s <= 1800 && (!best.has(r.product_id) || s < best.get(r.product_id)!)) best.set(r.product_id, s);
  }
  return best;
}

export async function quote(pickup: Place, dropoff: Place, stops: Place[]) {
  const city = await defaultCity();
  for (const p of [pickup, dropoff, ...stops]) {
    if (!inArea(p, city)) throw fail(422, `We don't serve ${p.address} yet. Pick a spot inside ${city.name}.`, "out_of_area");
  }
  const r = await route([pickup, ...stops, dropoff]);
  if (r.distanceM < 150) throw fail(422, "Pickup and drop-off are too close together.", "too_short");
  const [{ surge }, etas, products] = await Promise.all([
    busyMultiplier(city),
    pickupEtas(city.id, pickup),
    sql`select * from products where city_id = ${city.id} and active order by sort`,
  ]);
  return {
    city: { id: city.id, name: city.name, currency: city.currency },
    route: r,
    surge,
    options: products.map((p) => ({
      productId: p.id as string,
      code: p.code as string,
      name: p.name as string,
      description: p.description as string,
      seats: p.seats as number,
      fareCents: fare(p as unknown as PriceRule, r.distanceM, r.durationS, surge),
      pickupEtaS: etas.get(p.id) ?? null,
    })),
  };
}

export async function requestTrip(
  user: User,
  input: { productId: string; pickup: Place; dropoff: Place; stops: Place[]; quotedFareCents: number; paymentMethodId?: string; guest?: { name: string; phone: string } },
) {
  const q = await quote(input.pickup, input.dropoff, input.stops);
  // GPS and dropped-pin pickups get a real label before a driver ever sees them.
  const RAW = /^(Current location|Pinned spot)/;
  if (RAW.test(input.pickup.address)) input.pickup = { ...input.pickup, address: await describePoint(input.pickup, q.city.id) };
  if (RAW.test(input.dropoff.address)) input.dropoff = { ...input.dropoff, address: await describePoint(input.dropoff, q.city.id) };
  const opt = q.options.find((o) => o.productId === input.productId);
  if (!opt) throw fail(400, "That ride option isn't available.", "invalid");
  // The price the rider agreed to holds unless it went up by more than 5%.
  if (opt.fareCents > input.quotedFareCents * 1.05) {
    throw fail(409, `The price changed to ${money(opt.fareCents, q.city.currency)}. Check it and request again.`, "price_changed", { fareCents: opt.fareCents });
  }
  const fareCents = Math.min(opt.fareCents, Math.max(input.quotedFareCents, 0)) || opt.fareCents;

  const [pm] = input.paymentMethodId
    ? await sql`select id from payment_methods where id = ${input.paymentMethodId} and user_id = ${user.id}`
    : await sql`select id from payment_methods where user_id = ${user.id} and is_default`;
  if (!pm) throw fail(402, "Add a payment method before you request a ride.", "no_payment_method");
  const [debt] = await sql`select c.id from charges c where c.user_id = ${user.id} and c.status = 'failed' and c.kind <> 'tip'
    and not exists (select 1 from charges c2 where c2.trip_id = c.trip_id and c2.kind = c.kind and c2.status = 'succeeded') limit 1`;
  if (debt) throw fail(402, "A past ride wasn't paid. Update your payment method in Wallet first.", "unpaid_balance");

  try {
    return await sql.begin(async (tx) => {
      const [trip] = await tx`insert into trips ${tx({
        city_id: q.city.id, rider_id: user.id, product_id: opt.productId, payment_method_id: pm.id,
        pickup_lat: input.pickup.lat, pickup_lng: input.pickup.lng, pickup_address: input.pickup.address,
        dropoff_lat: input.dropoff.lat, dropoff_lng: input.dropoff.lng, dropoff_address: input.dropoff.address,
        guest_name: input.guest?.name ?? null, guest_phone: input.guest?.phone ?? null,
        est_distance_m: q.route.distanceM, est_duration_s: q.route.durationS,
        surge_multiplier: q.surge, quoted_fare_cents: fareCents, currency: q.city.currency,
      })} returning *`;
      for (const [i, s] of input.stops.entries()) {
        await tx`insert into trip_stops (trip_id, seq, lat, lng, address) values (${trip.id}, ${i + 1}, ${s.lat}, ${s.lng}, ${s.address})`;
      }
      await dispatchNext(tx, trip.id);
      return trip;
    });
  } catch (e) {
    if (isUnique(e, "one_live_trip_per_rider")) throw fail(409, "You already have a ride in progress.", "already_riding");
    throw e;
  }
}

/** Loads a trip only if the user is its rider, its driver, or an admin. */
export async function loadTripFor(user: User, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(404, "Trip not found", "not_found");
  const [t] = await sql`select t.*, p.name as product_name, p.code as product_code,
      p.wait_grace_min, p.wait_per_min_cents, p.cancel_free_min, p.cancel_fee_cents, p.no_show_min,
      p.base_cents, p.per_km_cents, p.per_min_cents, p.min_fare_cents, p.booking_fee_cents
    from trips t join products p on p.id = t.product_id where t.id = ${id}`;
  if (!t || (t.rider_id !== user.id && t.driver_id !== user.id && user.role !== "admin")) throw fail(404, "Trip not found", "not_found");
  return t;
}

const rule = (t: Record<string, unknown>) => t as unknown as PriceRule;

/** What a rider or driver sees about a trip. Never includes the other side's phone number. */
export async function tripView(t: Record<string, any>, viewer: User) {
  const asRider = t.rider_id === viewer.id;
  const [driver] = t.driver_id
    ? await sql`select u.name, case when u.rating_count > 0 then round(u.rating_sum::numeric / u.rating_count, 2)::float end as rating,
          dp.last_lat, dp.last_lng, dp.heading, v.make, v.model, v.colour, v.plate
        from users u join driver_profiles dp on dp.user_id = u.id left join vehicles v on v.id = ${t.vehicle_id}
        where u.id = ${t.driver_id}`
    : [];
  const [rider] = await sql`select name, case when rating_count > 0 then round(rating_sum::numeric / rating_count, 2)::float end as rating
    from users where id = ${t.rider_id}`;
  const stops = await sql`select seq, lat, lng, address, reached_at from trip_stops where trip_id = ${t.id} order by seq`;
  const [mine] = await sql`select stars from ratings where trip_id = ${t.id} and from_user_id = ${viewer.id}`;
  const [{ unread }] = await sql`select count(*)::int as unread from messages where trip_id = ${t.id} and sender_id <> ${viewer.id} and read_at is null`;
  const charges = await sql`select kind, amount_cents, status, failure_reason, created_at from charges where trip_id = ${t.id} order by created_at`;

  let etaS: number | null = null;
  const driverPos = driver ? { lat: driver.last_lat, lng: driver.last_lng, heading: driver.heading } : null;
  if (driverPos && t.status === "accepted") etaS = estimateRoute([driverPos, { lat: t.pickup_lat, lng: t.pickup_lng }]).durationS;
  if (driverPos && t.status === "in_progress") {
    const next = stops.find((s) => !s.reached_at);
    const pts = [driverPos, ...(next ? [{ lat: next.lat, lng: next.lng }] : []), { lat: t.dropoff_lat, lng: t.dropoff_lng }];
    etaS = estimateRoute(pts).durationS;
  }

  const now = new Date();
  const waitingS = t.status === "arrived" && t.arrived_at ? Math.floor((now.getTime() - new Date(t.arrived_at).getTime()) / 1000) : null;
  const cancelFeeIfNow = ["matching", "accepted", "arrived"].includes(t.status)
    ? cancelFee(rule(t), {
        by: asRider ? "rider" : "driver",
        now,
        acceptedAt: t.accepted_at,
        arrivedAt: t.arrived_at,
        promisedAt: t.pickup_eta_at,
        ...(driverPos && t.accept_distance_m != null
          ? { acceptDistanceM: t.accept_distance_m, currentDistanceM: Math.round(haversine(driverPos, { lat: t.pickup_lat, lng: t.pickup_lng })) }
          : {}),
      })
    : 0;
  const fareCents = t.final_fare_cents ?? t.quoted_fare_cents + (t.wait_fee_cents ?? 0);
  const otherId = asRider ? t.driver_id : t.rider_id;
  const otherPhoto = await hasAvatar(otherId);
  const showDriverPos = ["accepted", "arrived", "in_progress"].includes(t.status);

  return {
    id: t.id,
    status: t.status as string,
    role: asRider ? "rider" : t.driver_id === viewer.id ? "driver" : "admin",
    product: { name: t.product_name, code: t.product_code },
    pickup: { lat: t.pickup_lat, lng: t.pickup_lng, address: t.pickup_address },
    dropoff: { lat: t.dropoff_lat, lng: t.dropoff_lng, address: t.dropoff_address },
    stops,
    guest: t.guest_name ? { name: t.guest_name } : null,
    currency: t.currency,
    quotedFareCents: t.quoted_fare_cents,
    waitFeeCents: t.wait_fee_cents,
    fareCents,
    tipCents: t.tip_cents,
    cancelFeeCents: t.cancel_fee_cents,
    cancelFeeIfNow,
    surge: Number(t.surge_multiplier),
    estDistanceM: t.est_distance_m,
    estDurationS: t.est_duration_s,
    etaS,
    waitingS,
    waitGraceMin: t.wait_grace_min,
    noShowMin: t.no_show_min,
    times: {
      requested: t.requested_at, accepted: t.accepted_at, arrived: t.arrived_at, started: t.started_at,
      completed: t.completed_at, cancelled: t.cancelled_at, pickupEta: t.pickup_eta_at,
    },
    cancelReason: t.cancel_reason,
    driver: driver
      ? {
          firstName: firstName(driver.name), rating: driver.rating, photo: asRider && otherPhoto ? `/api/trips/${t.id}/photo` : null,
          car: driver.make ? { make: driver.make, model: driver.model, colour: driver.colour, plate: driver.plate } : null,
          position: showDriverPos ? driverPos : null,
        }
      : null,
    rider: {
      firstName: t.guest_name ? firstName(t.guest_name) : firstName(rider?.name ?? null), rating: rider?.rating ?? null,
      photo: !asRider && otherPhoto && !t.guest_name ? `/api/trips/${t.id}/photo` : null,
    },
    myRating: mine?.stars ?? null,
    tipOptions: asRider && t.status === "completed" && !t.tip_cents ? tipOptions(fareCents) : [],
    unread,
    charges: charges.map((c) => ({ kind: c.kind, amountCents: c.amount_cents, status: c.status, failure: c.failure_reason, at: c.created_at })),
  };
}

export async function currentTripFor(user: User, as: "rider" | "driver") {
  const rows = as === "rider"
    ? await sql`select id, status from trips where rider_id = ${user.id} and status in ${sql(LIVE_STATUSES as unknown as string[])} limit 1`
    : await sql`select id, status from trips where driver_id = ${user.id} and status in ('accepted','arrived','in_progress') limit 1`;
  if (!rows[0]) return null;
  if (rows[0].status === "matching") await advanceDispatch(rows[0].id);
  return tripView(await loadTripFor(user, rows[0].id), user);
}

/** The rider's most recent finished trip that still needs their rating (shown once). */
export async function unratedTripFor(user: User) {
  const [t] = await sql`select t.id from trips t where t.rider_id = ${user.id} and t.status = 'completed'
      and t.completed_at > now() - interval '24 hours'
      and not exists (select 1 from ratings r where r.trip_id = t.id and r.from_user_id = ${user.id})
    order by t.completed_at desc limit 1`;
  return t ? tripView(await loadTripFor(user, t.id), user) : null;
}

/** How far the assigned driver was from the pickup at accept time, and now. */
async function progress(t: Record<string, any>) {
  if (!t.driver_id || t.accept_distance_m == null) return {};
  const [d] = await sql`select last_lat, last_lng from driver_profiles where user_id = ${t.driver_id}`;
  if (d?.last_lat == null) return {};
  return {
    acceptDistanceM: t.accept_distance_m as number,
    currentDistanceM: Math.round(haversine({ lat: d.last_lat, lng: d.last_lng }, { lat: t.pickup_lat, lng: t.pickup_lng })),
  };
}

async function transition(user: User, id: string, from: string[], set: Record<string, unknown>) {
  const t = await loadTripFor(user, id);
  if (t.driver_id !== user.id) throw fail(403, "Only the trip's driver can do this.", "forbidden");
  if (!from.includes(t.status)) throw fail(409, "This trip has already moved on.", "bad_state");
  const [u] = await sql`update trips set ${sql(set)}, updated_at = now() where id = ${id} and status in ${sql(from)} returning *`;
  if (!u) throw fail(409, "This trip has already moved on.", "bad_state");
  return { before: t, after: u };
}

export async function markArrived(user: User, id: string) {
  const { after } = await transition(user, id, ["accepted"], { status: "arrived", arrived_at: new Date() });
  if (after.guest_phone) await sendSms(after.guest_phone, `${brand.name}: your driver is at the pickup spot.`);
  return after;
}

export async function startTrip(user: User, id: string) {
  const t = await loadTripFor(user, id);
  const now = new Date();
  const fee = t.arrived_at ? waitFee(rule(t), new Date(t.arrived_at), t.pickup_eta_at ? new Date(t.pickup_eta_at) : null, now) : 0;
  const { after } = await transition(user, id, ["arrived"], { status: "in_progress", started_at: now, wait_fee_cents: fee });
  return after;
}

export async function completeTrip(user: User, id: string) {
  const t = await loadTripFor(user, id);
  const finalFare = t.quoted_fare_cents + (t.wait_fee_cents ?? 0);
  const { after } = await transition(user, id, ["in_progress"], { status: "completed", completed_at: new Date(), final_fare_cents: finalFare });
  await sql`update trip_stops set reached_at = coalesce(reached_at, now()) where trip_id = ${id}`;
  const c = await charge({
    tripId: id, userId: t.rider_id, kind: "fare", amountCents: finalFare, currency: t.currency,
    paymentMethodId: t.payment_method_id, key: `trip:${id}:fare`,
  });
  await sendReceipt(id);
  return { trip: after, charge: c };
}

export async function sendReceipt(id: string) {
  const [t] = await sql`select t.*, u.email, u.name, p.name as product_name, d.name as driver_name, c.timezone
    from trips t join users u on u.id = t.rider_id join products p on p.id = t.product_id
    join cities c on c.id = t.city_id left join users d on d.id = t.driver_id where t.id = ${id}`;
  if (!t?.email) return;
  const when = new Date(t.completed_at ?? t.cancelled_at).toLocaleString("en-US", { timeZone: t.timezone, dateStyle: "medium", timeStyle: "short" });
  const lines = t.status === "completed"
    ? [
        `Thanks for riding with ${brand.name}, ${firstName(t.name)}.`, "",
        `${when} · ${t.product_name} with ${firstName(t.driver_name)}`,
        `From: ${t.pickup_address}`, `To: ${t.dropoff_address}`, "",
        `Trip fare: ${money(t.quoted_fare_cents, t.currency)}`,
        ...(t.wait_fee_cents ? [`Wait time: ${money(t.wait_fee_cents, t.currency)}`] : []),
        `Total: ${money(t.final_fare_cents, t.currency)}`, "",
        `Something wrong? Open the trip in Activity and tap Get help.`,
      ]
    : [`Your ride on ${when} was cancelled.`, `Cancellation fee: ${money(t.cancel_fee_cents, t.currency)}`, "", `Think this is wrong? Open the trip in Activity and tap Get help.`];
  await sendEmail(t.email, t.status === "completed" ? `Your ${brand.name} receipt` : `${brand.name}: ride cancelled`, lines.join("\n"));
}

export async function cancelTrip(user: User, id: string, opts: { reason?: string; noShow?: boolean }) {
  const t = await loadTripFor(user, id);
  const now = new Date();
  const isRider = t.rider_id === user.id;
  const isDriver = t.driver_id === user.id;
  if (!isRider && !isDriver) throw fail(403, "You can't cancel this trip.", "forbidden");
  if (!["matching", "accepted", "arrived"].includes(t.status)) {
    throw fail(409, t.status === "in_progress" ? "The trip has started. Ask your driver to end it." : "This trip is already over.", "bad_state");
  }
  const input = { now, acceptedAt: t.accepted_at, arrivedAt: t.arrived_at, promisedAt: t.pickup_eta_at, ...(await progress(t)) };

  if (isDriver) {
    if (opts.noShow) {
      const fee = cancelFee(rule(t), { by: "driver", ...input });
      if (fee === 0) throw fail(422, `You can mark a no-show after ${t.no_show_min} minutes of waiting at the pickup.`, "too_early");
      const [u] = await sql`update trips set status = 'cancelled_by_driver', cancelled_at = now(), cancel_reason = 'rider_no_show',
          cancel_fee_cents = ${fee}, updated_at = now() where id = ${id} and status = 'arrived' returning *`;
      if (!u) throw fail(409, "This trip has already moved on.", "bad_state");
      await charge({ tripId: id, userId: t.rider_id, kind: "cancellation", amountCents: fee, currency: t.currency, paymentMethodId: t.payment_method_id, key: `trip:${id}:cancel` });
      await sendReceipt(id);
      return u;
    }
    // Driver backs out: the rider keeps their place and we find someone else.
    return sql.begin(async (tx) => {
      const [u] = await tx`update trips set status = 'matching', driver_id = null, vehicle_id = null, accepted_at = null,
          arrived_at = null, pickup_eta_at = null, updated_at = now()
        where id = ${id} and driver_id = ${user.id} and status in ('accepted','arrived') returning *`;
      if (!u) throw fail(409, "This trip has already moved on.", "bad_state");
      await dispatchNext(tx, id);
      return u;
    });
  }

  const fee = cancelFee(rule(t), { by: "rider", ...input });
  const [u] = await sql`update trips set status = 'cancelled_by_rider', cancelled_at = now(), cancel_reason = ${opts.reason ?? null},
      cancel_fee_cents = ${fee}, updated_at = now()
    where id = ${id} and status in ('matching','accepted','arrived') returning *`;
  if (!u) throw fail(409, "This trip has already moved on.", "bad_state");
  await sql`update dispatch_offers set response = 'lost', responded_at = now() where trip_id = ${id} and response = 'pending'`;
  if (fee > 0) {
    await charge({ tripId: id, userId: t.rider_id, kind: "cancellation", amountCents: fee, currency: t.currency, paymentMethodId: t.payment_method_id, key: `trip:${id}:cancel` });
    await sendReceipt(id);
  }
  return u;
}

export async function changeDestination(user: User, id: string, dropoff: Place) {
  const t = await loadTripFor(user, id);
  if (t.rider_id !== user.id) throw fail(403, "Only the rider can change the destination.", "forbidden");
  if (!["accepted", "arrived", "in_progress"].includes(t.status)) throw fail(409, "You can't change the destination now.", "bad_state");
  const city = await defaultCity();
  if (!inArea(dropoff, city)) throw fail(422, `We don't serve ${dropoff.address} yet.`, "out_of_area");
  const stops = await sql`select lat, lng from trip_stops where trip_id = ${id} and reached_at is null order by seq`;
  const r = await route([{ lat: t.pickup_lat, lng: t.pickup_lng }, ...stops.map((s) => ({ lat: s.lat, lng: s.lng })), dropoff]);
  const newFare = fare(rule(t), r.distanceM, r.durationS, Number(t.surge_multiplier));
  const [u] = await sql`update trips set dropoff_lat = ${dropoff.lat}, dropoff_lng = ${dropoff.lng}, dropoff_address = ${dropoff.address},
      est_distance_m = ${r.distanceM}, est_duration_s = ${r.durationS}, quoted_fare_cents = ${newFare}, updated_at = now()
    where id = ${id} and status in ('accepted','arrived','in_progress') returning *`;
  if (!u) throw fail(409, "You can't change the destination now.", "bad_state");
  return u;
}

export async function rateTrip(user: User, id: string, stars: number, tags: string[], comment?: string) {
  const t = await loadTripFor(user, id);
  if (t.status !== "completed") throw fail(409, "You can rate a trip once it's finished.", "bad_state");
  const to = t.rider_id === user.id ? t.driver_id : t.driver_id === user.id ? t.rider_id : null;
  if (!to) throw fail(403, "You can't rate this trip.", "forbidden");
  try {
    await sql.begin(async (tx) => {
      await tx`insert into ratings (trip_id, from_user_id, to_user_id, stars, tags, comment)
        values (${id}, ${user.id}, ${to}, ${stars}, ${tags}, ${comment ?? null})`;
      await tx`update users set rating_sum = rating_sum + ${stars}, rating_count = rating_count + 1 where id = ${to}`;
    });
  } catch (e) {
    if (isUnique(e)) throw fail(409, "You already rated this trip.", "already_rated");
    throw e;
  }
}

export async function tipTrip(user: User, id: string, cents: number) {
  const t = await loadTripFor(user, id);
  if (t.rider_id !== user.id) throw fail(403, "Only the rider can tip.", "forbidden");
  if (t.status !== "completed") throw fail(409, "You can tip once the trip is finished.", "bad_state");
  if (Date.now() - new Date(t.completed_at).getTime() > 30 * 86400_000) throw fail(409, "Tips can be added up to 30 days after a trip.", "too_late");
  if (t.tip_cents > 0) throw fail(409, "You already tipped on this trip.", "already_tipped");
  if (cents < 100 || cents > Math.max(10000, t.final_fare_cents)) throw fail(400, "Pick a tip between $1 and the fare (or $100).", "invalid");
  const c = await charge({ tripId: id, userId: user.id, kind: "tip", amountCents: cents, currency: t.currency, paymentMethodId: t.payment_method_id, key: `trip:${id}:tip` });
  if (c.status === "succeeded") await sql`update trips set tip_cents = ${cents} where id = ${id}`;
  return c;
}

export async function shareLink(user: User, id: string) {
  const t = await loadTripFor(user, id);
  if (t.rider_id !== user.id) throw fail(403, "Only the rider can share the trip.", "forbidden");
  const [existing] = await sql`select token from share_links where trip_id = ${id} and expires_at > now() limit 1`;
  const token = existing?.token ?? randomBytes(16).toString("base64url");
  if (!existing) await sql`insert into share_links (trip_id, token, expires_at) values (${id}, ${token}, now() + interval '12 hours')`;
  return `${process.env.APP_URL || "http://localhost:3000"}/t/${token}`;
}

/** Public, token-gated view: status, positions, driver first name and car. No phone numbers or names of the rider. */
export async function sharedTrip(token: string) {
  const [s] = await sql`select trip_id from share_links where token = ${token} and expires_at > now()`;
  if (!s) return null;
  const [t] = await sql`select t.*, u.name as driver_name, dp.last_lat, dp.last_lng, v.make, v.model, v.colour, v.plate
    from trips t left join users u on u.id = t.driver_id left join driver_profiles dp on dp.user_id = t.driver_id
    left join vehicles v on v.id = t.vehicle_id where t.id = ${s.trip_id}`;
  const live = ["accepted", "arrived", "in_progress"].includes(t.status);
  const pos = live && t.last_lat != null ? { lat: t.last_lat, lng: t.last_lng } : null;
  const target = t.status === "in_progress" ? { lat: t.dropoff_lat, lng: t.dropoff_lng } : { lat: t.pickup_lat, lng: t.pickup_lng };
  return {
    status: t.status as string,
    pickup: { lat: t.pickup_lat, lng: t.pickup_lng, address: t.pickup_address },
    dropoff: { lat: t.dropoff_lat, lng: t.dropoff_lng, address: t.dropoff_address },
    driver: t.driver_id ? { firstName: firstName(t.driver_name), car: t.make ? { make: t.make, model: t.model, colour: t.colour, plate: t.plate } : null, position: pos } : null,
    etaS: pos ? estimateRoute([pos, target]).durationS : null,
  };
}
