"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import type { Place, Quote, Trip } from "@/lib/types";
import { MapView, type Marker } from "@/components/MapView";
import { useGeolocation } from "@/components/shared/useGeolocation";
import { NavMenu } from "./NavMenu";
import { HomeSheet } from "./HomeSheet";
import { SearchSheet, type Draft } from "./SearchSheet";
import { ChooseSheet } from "./ChooseSheet";
import { TripSheet } from "./TripSheet";
import { RateSheet } from "./RateSheet";
import { OutcomeSheet } from "./OutcomeSheet";

type Phase = "home" | "search" | "choose";
type City = { name: string; center: { lat: number; lng: number } };

export function RiderApp({ userName, city }: { userName: string; city: City }) {
  const geo = useGeolocation();
  const [phase, setPhase] = useState<Phase>("home");
  const [menu, setMenu] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [toRate, setToRate] = useState<Trip | null>(null);
  const [outcome, setOutcome] = useState<Trip | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft>({ pickup: null, dropoff: null, stops: [], guest: null });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pickingPickup, setPickingPickup] = useState(false);
  const lastTripId = useRef<string | null>(null);

  // Current location becomes the default pickup until the rider picks another.
  const here: Place | null = geo.pos ? { lat: geo.pos.lat, lng: geo.pos.lng, address: "Current location" } : null;
  useEffect(() => {
    if (here && !draft.pickup) setDraft((d) => ({ ...d, pickup: here }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.pos?.lat, geo.pos?.lng]);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ trip: Trip | null; toRate: Trip | null }>("/api/trips/current");
      if (r.trip) {
        lastTripId.current = r.trip.id;
        setTrip(r.trip);
      } else {
        // The live trip just ended: show how (finished, no cars, driver marked a no-show).
        if (lastTripId.current) {
          const id = lastTripId.current;
          lastTripId.current = null;
          const t = await api<{ trip: Trip }>(`/api/trips/${id}`).then((x) => x.trip).catch(() => null);
          if (t && t.status !== "completed" && t.status !== "cancelled_by_rider") setOutcome(t);
        }
        setTrip(null);
        setToRate(r.toRate);
      }
    } catch {
      /* keep the last state on a blip; the next poll retries */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!trip) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [trip, refresh]);

  const startOver = () => {
    setPhase("home");
    setQuote(null);
    setPickingPickup(false);
    setDraft({ pickup: here, dropoff: null, stops: [], guest: null });
  };

  const markers = useMemo<Marker[]>(() => {
    const m: Marker[] = [];
    if (trip) {
      m.push({ id: "pickup", kind: "pickup", ...trip.pickup });
      trip.stops.forEach((s) => m.push({ id: `s${s.seq}`, kind: "stop", lat: s.lat, lng: s.lng, label: String(s.seq) }));
      m.push({ id: "dropoff", kind: "dropoff", ...trip.dropoff });
      if (trip.driver?.position) m.push({ id: "car", kind: "car", ...trip.driver.position });
      return m;
    }
    if (geo.pos) m.push({ id: "me", kind: "me", lat: geo.pos.lat, lng: geo.pos.lng });
    if (phase !== "home" && draft.pickup) m.push({ id: "pickup", kind: "pickup", ...draft.pickup });
    draft.stops.forEach((s, i) => s && m.push({ id: `s${i}`, kind: "stop", lat: s.lat, lng: s.lng, label: String(i + 1) }));
    if (phase !== "home" && draft.dropoff) m.push({ id: "dropoff", kind: "dropoff", ...draft.dropoff });
    return m;
  }, [trip, geo.pos, phase, draft]);

  const routeLine = useMemo(() => {
    if (trip) {
      if (trip.status === "accepted" && trip.driver?.position) return [trip.driver.position, trip.pickup];
      return [trip.pickup, ...trip.stops, trip.dropoff];
    }
    if (phase === "choose" && quote) return quote.route.geometry;
    return undefined;
  }, [trip, phase, quote]);

  let sheet: React.ReactNode;
  if (!loaded) sheet = <div className="h-40" aria-busy="true" />;
  else if (trip) sheet = <TripSheet trip={trip} onChange={refresh} />;
  else if (outcome) sheet = <OutcomeSheet trip={outcome} onDone={() => { setOutcome(null); startOver(); }} onRetry={() => {
    setDraft({ pickup: outcome.pickup, dropoff: outcome.dropoff, stops: outcome.stops.map((s) => ({ lat: s.lat, lng: s.lng, address: s.address })), guest: null });
    setOutcome(null);
    setPhase("choose");
  }} />;
  else if (toRate) sheet = <RateSheet trip={toRate} onDone={() => { setToRate(null); refresh(); }} />;
  else if (phase === "home") sheet = <HomeSheet name={userName} geoStatus={geo.status} onSearch={() => setPhase("search")} onPlace={(p) => { setDraft((d) => ({ ...d, dropoff: p })); setPhase(draft.pickup ? "choose" : "search"); }} />;
  else if (phase === "search") sheet = <SearchSheet draft={draft} near={geo.pos} onChange={setDraft} onBack={startOver} onDone={() => setPhase("choose")} />;
  else sheet = (
    <ChooseSheet
      draft={draft}
      pickingPickup={pickingPickup}
      onPickPickup={() => setPickingPickup((v) => !v)}
      onQuote={setQuote}
      onBack={() => { setPhase("search"); setPickingPickup(false); }}
      onRequested={(t) => { lastTripId.current = t.id; setTrip(t); setPhase("home"); setQuote(null); }}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="relative min-h-[28dvh] flex-1">
        <MapView
          markers={markers}
          route={routeLine}
          center={geo.pos ?? city.center}
          label={trip ? "Map of your trip" : `Map of ${city.name}`}
          onPick={pickingPickup ? (p) => {
            setDraft((d) => ({ ...d, pickup: { ...p, address: `Pinned spot (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})` } }));
          } : undefined}
        />
        <button
          type="button"
          onClick={() => setMenu(true)}
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] grid h-12 w-12 place-items-center rounded-pill bg-bg shadow-card"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        {pickingPickup && (
          <p role="status" className="absolute inset-x-4 top-20 mx-auto max-w-sm rounded-md bg-bg px-3 py-2 text-center text-sm shadow-card">
            Tap the map where you want to be picked up
          </p>
        )}
      </div>
      {sheet}
      <NavMenu open={menu} onClose={() => setMenu(false)} name={userName} />
    </div>
  );
}

export function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : "Something went wrong.";
}
