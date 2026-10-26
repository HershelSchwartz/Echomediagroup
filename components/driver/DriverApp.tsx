"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, MessageCircle, Navigation, Star, Wallet } from "lucide-react";
import { api, ApiError, fmtKm, fmtMin, fmtMoney } from "@/lib/client";
import type { Place, Trip } from "@/lib/types";
import { stepToward, bearing, haversine } from "@/lib/geo";
import { MapView, type Marker } from "@/components/MapView";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { HoldButton } from "@/components/ui/HoldButton";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ListRow } from "@/components/ui/ListRow";
import { StarRating } from "@/components/ui/StarRating";
import { ChatPanel } from "@/components/shared/ChatPanel";
import { Avatar } from "@/components/ui/Avatar";
import { useGeolocation } from "@/components/shared/useGeolocation";

type Offer = {
  id: string; expiresAt: string; productName: string; pickup: Place; dropoff: Place; stops: number;
  toPickupS: number | null; toPickupM: number | null; tripS: number; tripM: number; earningsCents: number; currency: string;
  riderFareCents: number; platformCents: number;
};
type State = {
  profile: { status: string; online: boolean; position: { lat: number; lng: number } | null; destination: { lat: number; lng: number; label: string } | null };
  vehicle: { make: string; model: string; plate: string } | null;
  today: { earningsCents: number; trips: number };
  offer: Offer | null;
  trip: Trip | null;
};

const SIM_SPEED_MS = 40; // demo driving speed for the simulator, metres per second (sped up)
const PING_MS = 3000;

export function DriverApp({ city, simulate }: { city: { name: string; center: { lat: number; lng: number } }; simulate: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sim, setSim] = useState(simulate);
  const [simPos, setSimPos] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const [finished, setFinished] = useState<Trip | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const lastTripId = useRef<string | null>(null);
  const geo = useGeolocation(!sim);

  const pos = sim ? simPos : geo.pos;

  const load = useCallback(async () => {
    try {
      const s = await api<State>("/api/driver/state");
      setState(s);
      setSimPos((p) => p ?? (s.profile.position ? { ...s.profile.position, heading: null } : { ...city.center, heading: null }));
      if (s.trip) lastTripId.current = s.trip.id;
      else if (lastTripId.current) {
        const id = lastTripId.current;
        lastTripId.current = null;
        const t = await api<{ trip: Trip }>(`/api/trips/${id}`).then((r) => r.trip).catch(() => null);
        if (t && (t.status === "completed" || t.status === "cancelled_by_rider")) setFinished(t);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [city.center]);

  useEffect(() => { load(); const t = setInterval(load, PING_MS); return () => clearInterval(t); }, [load]);

  // Report position while online or on a trip.
  const online = !!state?.profile.online;
  const onTrip = !!state?.trip;
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    if (!online && !onTrip) return;
    const send = () => { const p = posRef.current; if (p) api("/api/driver/location", { body: { lat: p.lat, lng: p.lng, heading: p.heading } }).catch(() => {}); };
    send();
    const t = setInterval(send, PING_MS);
    return () => clearInterval(t);
  }, [online, onTrip]);

  // Simulator: drive toward the pickup, then through stops to the drop-off.
  const target = useMemo(() => {
    const t = state?.trip;
    if (!t) return null;
    if (t.status === "accepted") return t.pickup;
    if (t.status === "in_progress") return t.stops.find((s) => !s.reached_at) ?? t.dropoff;
    return null;
  }, [state?.trip]);
  useEffect(() => {
    if (!sim || !target) return;
    const t = setInterval(() => setSimPos((p) => {
      if (!p) return p;
      const n = stepToward(p, target, (SIM_SPEED_MS * 1000) / 1000);
      return { ...n, heading: haversine(p, target) > 1 ? bearing(p, target) : p.heading };
    }), 1000);
    return () => clearInterval(t);
  }, [sim, target]);

  // Keep the screen awake while online: browsers pause location in the background.
  useEffect(() => {
    if (!online || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as any).wakeLock.request("screen").then((l: any) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [online]);

  async function act(key: string, path: string, body: unknown = {}) {
    setBusy(key);
    setError(null);
    try {
      await api(path, { body });
      await load();
      return true;
    } catch (e) {
      setError((e as ApiError).message);
      await load();
      return false;
    } finally {
      setBusy(null);
    }
  }

  const markers = useMemo<Marker[]>(() => {
    const m: Marker[] = [];
    if (pos) m.push({ id: "car", kind: "car", lat: pos.lat, lng: pos.lng, heading: pos.heading });
    const t = state?.trip;
    const o = state?.offer;
    if (t) {
      m.push({ id: "p", kind: "pickup", ...t.pickup });
      t.stops.forEach((s) => m.push({ id: `s${s.seq}`, kind: "stop", lat: s.lat, lng: s.lng, label: String(s.seq) }));
      if (t.status === "in_progress") m.push({ id: "d", kind: "dropoff", ...t.dropoff });
    } else if (o) {
      m.push({ id: "p", kind: "pickup", ...o.pickup }, { id: "d", kind: "dropoff", ...o.dropoff });
    }
    return m;
  }, [pos, state?.trip, state?.offer]);

  const routeLine = useMemo(() => {
    if (pos && target) return [pos, target];
    if (state?.offer) return [state.offer.pickup, state.offer.dropoff];
    return undefined;
  }, [pos, target, state?.offer]);

  if (!state) return <div className="grid h-dvh place-items-center text-text-muted" aria-busy="true">Loading…</div>;
  const t = state.trip;

  let sheet: React.ReactNode;
  if (finished) sheet = <FinishedSheet trip={finished} onDone={() => setFinished(null)} />;
  else if (t) sheet = (
    <TripSheet
      trip={t} busy={busy} error={error}
      onArrived={() => act("arrived", `/api/trips/${t.id}/arrived`)}
      onStart={() => act("start", `/api/trips/${t.id}/start`)}
      onComplete={() => act("complete", `/api/trips/${t.id}/complete`)}
      onNoShow={() => act("noshow", `/api/trips/${t.id}/cancel`, { noShow: true })}
      onBackOut={() => act("backout", `/api/trips/${t.id}/cancel`, { reason: "driver_cancelled" })}
      onChat={() => setChatOpen(true)}
    />
  );
  else if (state.offer) sheet = (
    <OfferSheet offer={state.offer} busy={busy} error={error}
      onAccept={() => act("accept", `/api/driver/offers/${state.offer!.id}/accept`)}
      onDecline={() => act("decline", `/api/driver/offers/${state.offer!.id}/decline`)} />
  );
  else sheet = (
    <Sheet label="Driver status">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/drive/earnings" className="flex h-12 items-center gap-2 rounded-pill bg-surface px-4 font-semibold">
          <Wallet className="h-4 w-4" aria-hidden />{fmtMoney(state.today.earningsCents)}<span className="sr-only"> earned today</span>
        </Link>
        <span className="text-sm text-text-muted">{state.today.trips} trip{state.today.trips === 1 ? "" : "s"} today</span>
      </div>
      {error && <Banner variant="danger" className="mb-2">{error}</Banner>}
      {online ? (
        <>
          <h1 className="text-xl font-bold" aria-live="polite">You're online</h1>
          <p className="mb-3 text-sm text-text-muted">Looking for trips near you. Keep this screen open.</p>
          <ListRow icon={<Flag className="h-5 w-5" />} title={state.profile.destination ? "Heading to" : "Set a destination"}
            subtitle={state.profile.destination?.label ?? "Only get trips going your way"} onClick={() => setDestOpen(true)} />
          <Button variant="secondary" block className="mt-2" loading={busy === "offline"} onClick={() => act("offline", "/api/driver/online", { online: false })}>Go offline</Button>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold">You're offline</h1>
          <p className="mb-3 text-sm text-text-muted">{state.vehicle ? `${state.vehicle.make} ${state.vehicle.model} · ${state.vehicle.plate}` : ""}</p>
          {!sim && geo.status === "denied" && <Banner variant="warning" className="mb-2">Turn on location for this site so riders can find you.</Banner>}
          <Button size="lg" block className="h-16 rounded-pill text-xl" loading={busy === "online"} disabled={!pos}
            onClick={() => act("online", "/api/driver/online", { online: true, position: pos ? { lat: pos.lat, lng: pos.lng } : undefined })}>
            Go
          </Button>
        </>
      )}
      {simulate && (
        <label className="mt-3 flex items-center gap-2 text-sm text-text-muted">
          <input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
          Simulate driving (development only)
        </label>
      )}
    </Sheet>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="relative min-h-[28dvh] flex-1">
        <MapView markers={markers} route={routeLine} center={pos ?? city.center} label="Map around you" />
        <Link href="/ride" className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] grid h-12 w-12 place-items-center rounded-pill bg-bg shadow-card" aria-label="Back to riding">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>
      {sheet}
      {t && t.driver && (
        <ChatPanel tripId={t.id} open={chatOpen} onClose={() => setChatOpen(false)} otherName={t.rider.firstName}
          quickReplies={["I'm here", "On my way", "Can't find you, where are you?"]} />
      )}
      {destOpen && <DestinationDialog current={state.profile.destination} onClose={() => setDestOpen(false)} onSaved={() => { setDestOpen(false); load(); }} />}
    </div>
  );
}

function OfferSheet({ offer, busy, error, onAccept, onDecline }: { offer: Offer; busy: string | null; error: string | null; onAccept: () => void; onDecline: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    navigator.vibrate?.([200, 100, 200]);
    const i = setInterval(() => setLeft(Math.max(0, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000))), 250);
    return () => clearInterval(i);
  }, [offer.id, offer.expiresAt]);
  return (
    <Sheet label="New trip request">
      <div role="alert" className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{offer.productName} request</p>
          <p className="text-3xl font-bold">{fmtMoney(offer.earningsCents, offer.currency)}</p>
          <p className="text-sm text-text-muted">you earn, before tips</p>
          <p className="text-xs text-text-muted" data-testid="fare-split">Rider pays {fmtMoney(offer.riderFareCents, offer.currency)} · we keep {fmtMoney(offer.platformCents, offer.currency)}</p>
        </div>
        <div className={`grid h-14 w-14 place-items-center rounded-pill border-4 text-lg font-bold ${left <= 5 ? "border-warning text-warning" : "border-accent"}`}>
          {left}<span className="sr-only"> seconds left</span>
        </div>
      </div>
      <dl className="my-3 space-y-2 text-sm">
        <div className="border-l-4 border-pickup pl-2"><dt className="font-semibold">{fmtMin(offer.toPickupS)} ({offer.toPickupM != null ? fmtKm(offer.toPickupM) : ""}) away</dt><dd className="text-text-muted">{offer.pickup.address}</dd></div>
        <div className="border-l-4 border-dropoff pl-2"><dt className="font-semibold">{fmtMin(offer.tripS)} ({fmtKm(offer.tripM)}) trip{offer.stops ? ` · ${offer.stops} stop${offer.stops > 1 ? "s" : ""}` : ""}</dt><dd className="text-text-muted">{offer.dropoff.address}</dd></div>
      </dl>
      {error && <Banner variant="danger" className="mb-2">{error}</Banner>}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="secondary" size="lg" loading={busy === "decline"} onClick={onDecline}>Decline</Button>
        <Button size="lg" loading={busy === "accept"} disabled={left === 0} onClick={onAccept}>Accept</Button>
      </div>
    </Sheet>
  );
}

function TripSheet({ trip, busy, error, onArrived, onStart, onComplete, onNoShow, onBackOut, onChat }: {
  trip: Trip; busy: string | null; error: string | null; onArrived: () => void; onStart: () => void; onComplete: () => void;
  onNoShow: () => void; onBackOut: () => void; onChat: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const target = trip.status === "in_progress" ? (trip.stops.find((s) => !s.reached_at) ?? trip.dropoff) : trip.pickup;
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`;
  const waited = trip.waitingS ?? 0;
  const noShowReady = waited >= trip.noShowMin * 60;
  return (
    <Sheet label="Current trip">
      <div aria-live="polite">
        {trip.status === "accepted" && <h1 className="text-xl font-bold">Pick up {trip.rider.firstName}{trip.etaS != null ? ` · ${fmtMin(trip.etaS)}` : ""}</h1>}
        {trip.status === "arrived" && <h1 className="text-xl font-bold">Waiting for {trip.rider.firstName} · {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, "0")}</h1>}
        {trip.status === "in_progress" && <h1 className="text-xl font-bold">Drop off {trip.rider.firstName}{trip.etaS != null ? ` · ${fmtMin(trip.etaS)}` : ""}</h1>}
      </div>
      {trip.rider.photo && <div className="mb-2"><Avatar name={trip.rider.firstName} src={trip.rider.photo} size={40} /></div>}
      <p className="mb-3 text-sm text-text-muted">{"address" in target ? target.address : ""}{trip.rider.rating != null && <span className="ml-2 inline-flex items-center gap-0.5"><Star className="h-3.5 w-3.5 fill-accent" aria-hidden />{trip.rider.rating.toFixed(1)}</span>}</p>
      {error && <Banner variant="danger" className="mb-2">{error}</Banner>}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <a href={nav} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-surface font-semibold"><Navigation className="h-5 w-5" aria-hidden />Navigate</a>
        <Button variant="secondary" onClick={onChat} className="relative"><MessageCircle className="h-5 w-5" aria-hidden />Message
          {trip.unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-pill bg-danger px-1 text-xs text-on-danger">{trip.unread}</span>}
        </Button>
      </div>
      {trip.status === "accepted" && <Button block size="lg" loading={busy === "arrived"} onClick={onArrived}>I've arrived</Button>}
      {trip.status === "arrived" && (
        <>
          <HoldButton onConfirm={onStart} disabled={busy === "start"}>Hold to start trip</HoldButton>
          <Button variant="ghost" block className="mt-2" disabled={!noShowReady} loading={busy === "noshow"} onClick={onNoShow}>
            {noShowReady ? "Rider didn't show up" : `No-show available after ${trip.noShowMin} min`}
          </Button>
        </>
      )}
      {trip.status === "in_progress" && <HoldButton onConfirm={onComplete} disabled={busy === "complete"}>Hold to end trip</HoldButton>}
      {(trip.status === "accepted" || trip.status === "arrived") && (
        <Button variant="ghost" block className="mt-1 text-danger" onClick={() => setConfirm(true)}>Cancel trip</Button>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Cancel this trip?">
        <p className="mb-4 text-sm">We'll find the rider another driver. Cancelling often can affect your account.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirm(false)}>Keep trip</Button>
          <Button variant="danger" loading={busy === "backout"} onClick={() => { setConfirm(false); onBackOut(); }}>Cancel trip</Button>
        </div>
      </Modal>
    </Sheet>
  );
}

function FinishedSheet({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);
  const cancelled = trip.status !== "completed";
  async function rate() {
    setBusy(true);
    await api(`/api/trips/${trip.id}/rate`, { body: { stars } }).catch(() => {});
    setBusy(false);
    onDone();
  }
  if (cancelled) {
    return (
      <Sheet label="Trip cancelled">
        <h1 className="text-xl font-bold">The rider cancelled</h1>
        <p className="mb-3 text-sm text-text-muted">{trip.cancelFeeCents > 0 ? "They were charged a cancellation fee, and you'll get your share." : "You're back online and we're looking for your next trip."}</p>
        <Button block onClick={onDone}>OK</Button>
      </Sheet>
    );
  }
  return (
    <Sheet label="Trip complete">
      <h1 className="text-xl font-bold">Trip complete</h1>
      <p className="mb-3 text-sm text-text-muted">Fare {fmtMoney(trip.fareCents, trip.currency)} · see Earnings for your share</p>
      <p className="mb-2 text-center font-medium">How was {trip.rider.firstName}?</p>
      <StarRating value={stars} onChange={setStars} label={`Rate ${trip.rider.firstName}`} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onDone}>Skip</Button>
        <Button disabled={!stars} loading={busy} onClick={rate}>Submit</Button>
      </div>
    </Sheet>
  );
}

function DestinationDialog({ current, onClose, onSaved }: { current: { label: string } | null; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => api<{ places: Place[] }>(`/api/places/search?q=${encodeURIComponent(q)}`).then((r) => setHits(r.places)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  async function save(place: Place | null) {
    try {
      await api("/api/driver/destination", { body: { place: place ? { lat: place.lat, lng: place.lng, address: place.name ?? place.address } : null } });
      onSaved();
    } catch (e) { setError((e as ApiError).message); }
  }
  return (
    <Modal open onClose={onClose} title="Where are you heading?">
      <p className="mb-2 text-sm text-text-muted">You'll only get trips that end closer to this place.</p>
      <Field label="Destination" hideLabel placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <ul className="my-2 max-h-60 overflow-y-auto">{hits.map((h, i) => <li key={i}><ListRow title={h.name ?? h.address} subtitle={h.name ? h.address : undefined} onClick={() => save(h)} /></li>)}</ul>
      {current && <Button variant="secondary" block onClick={() => save(null)}>Clear destination</Button>}
      <Button variant="ghost" block className="mt-1" onClick={onClose}>Close</Button>
    </Modal>
  );
}
