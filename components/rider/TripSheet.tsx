"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Pencil, Share2, ShieldAlert, Star } from "./icons";
import { api, ApiError, fmtClock, fmtMin, fmtMoney } from "@/lib/client";
import type { Place, Trip } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ListRow } from "@/components/ui/ListRow";
import { ChatPanel } from "@/components/shared/ChatPanel";

export function TripSheet({ trip, onChange }: { trip: Trip; onChange: () => void }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const d = trip.driver;
  const canCancel = ["matching", "accepted", "arrived"].includes(trip.status);
  const live = ["accepted", "arrived", "in_progress"].includes(trip.status);

  let title = "";
  let sub = "";
  if (trip.status === "matching") { title = "Finding you a driver"; sub = "This usually takes under a minute."; }
  if (trip.status === "accepted") { title = trip.etaS != null ? `Your driver is ${fmtMin(trip.etaS)} away` : "Your driver is on the way"; sub = "Meet them at the green pickup dot."; }
  if (trip.status === "arrived") {
    title = "Your driver is here";
    const left = trip.waitGraceMin * 60 - (trip.waitingS ?? 0);
    sub = left > 0 ? `They'll wait ${Math.ceil(left / 60)} more min before wait time is added to the fare.` : "Wait time is now being added to the fare.";
  }
  if (trip.status === "in_progress") { title = trip.etaS != null ? `Arriving at ${fmtClock(new Date(Date.now() + trip.etaS * 1000))}` : "On the way"; sub = `Heading to ${trip.dropoff.address}`; }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/trips/${trip.id}/cancel`, { body: { reason: "rider_cancelled" } });
      setCancelOpen(false);
      onChange();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    try {
      const { url } = await api<{ url: string }>(`/api/trips/${trip.id}/share`, { body: {} });
      if (navigator.share) await navigator.share({ title: "Follow my ride", url }).catch(() => {});
      else { await navigator.clipboard?.writeText(url).catch(() => {}); }
      setShareNote(`Link ready: ${url}`);
    } catch (e) {
      setShareNote((e as ApiError).message);
    }
  }

  return (
    <Sheet label="Your ride">
      <div aria-live="polite">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-text-muted">{sub}</p>
      </div>

      {trip.status === "matching" && (
        <div className="my-4 h-1 overflow-hidden rounded-pill bg-surface-2" aria-hidden>
          <div className="skeleton h-full w-1/3 rounded-pill bg-accent" />
        </div>
      )}

      {d && live && (
        <div className="my-3 flex items-center gap-3 rounded-md bg-surface p-3" data-testid="driver-card">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-accent text-lg font-bold text-on-accent" aria-hidden>{d.firstName[0]}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{d.firstName}{d.rating != null && <span className="ml-2 inline-flex items-center gap-0.5 text-sm font-normal"><Star className="h-3.5 w-3.5 fill-accent" aria-hidden />{d.rating.toFixed(1)}<span className="sr-only"> rating</span></span>}</p>
            {d.car && <p className="truncate text-sm text-text-muted">{d.car.colour} {d.car.make} {d.car.model}</p>}
          </div>
          {d.car && <span className="rounded-sm bg-bg px-2 py-1 font-mono text-sm font-bold" aria-label={`Plate ${d.car.plate.split("").join(" ")}`}>{d.car.plate}</span>}
        </div>
      )}

      {trip.guest && <Banner className="mb-2">Booked for {trip.guest.name}. We've texted them updates.</Banner>}
      {error && <Banner variant="danger" className="mb-2">{error}</Banner>}
      {shareNote && <Banner variant="success" className="mb-2 break-all">{shareNote}</Banner>}

      <div className="grid grid-cols-3 gap-2">
        {live && (
          <Button variant="secondary" onClick={() => setChatOpen(true)} className="relative">
            <MessageCircle className="h-5 w-5" aria-hidden />Message
            {trip.unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-pill bg-danger px-1 text-xs text-on-danger">{trip.unread}<span className="sr-only"> unread</span></span>}
          </Button>
        )}
        <Button variant="secondary" onClick={share}><Share2 className="h-5 w-5" aria-hidden />Share</Button>
        {trip.status === "in_progress" && <Button variant="secondary" onClick={() => setSafetyOpen(true)}><ShieldAlert className="h-5 w-5" aria-hidden />Safety</Button>}
        {canCancel && <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancel</Button>}
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2"><dt className="sr-only">Pickup</dt><span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-pill bg-pickup" /><dd className="truncate">{trip.pickup.address}</dd></div>
        {trip.stops.map((s) => <div key={s.seq} className="flex gap-2"><dt className="sr-only">Stop {s.seq}</dt><span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-pill border border-dropoff" /><dd className="truncate">{s.address}</dd></div>)}
        <div className="flex items-center gap-2"><dt className="sr-only">Drop-off</dt><span aria-hidden className="h-2 w-2 shrink-0 bg-dropoff" /><dd className="min-w-0 flex-1 truncate">{trip.dropoff.address}</dd>
          {live && <Button variant="ghost" size="sm" onClick={() => setDestOpen(true)}><Pencil className="h-4 w-4" aria-hidden />Change</Button>}
        </div>
        <div className="flex justify-between pt-1"><dt className="text-text-muted">{trip.product.name}{trip.waitFeeCents > 0 ? " · incl. wait time" : ""}</dt><dd className="font-semibold">{fmtMoney(trip.fareCents, trip.currency)}</dd></div>
      </dl>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this ride?">
        <p className="mb-4 text-sm">
          {trip.cancelFeeIfNow > 0
            ? `Your driver is already on the way, so cancelling now costs ${fmtMoney(trip.cancelFeeIfNow, trip.currency)}.`
            : "You won't be charged."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep ride</Button>
          <Button variant="danger" loading={busy} onClick={cancel}>Cancel ride</Button>
        </div>
      </Modal>

      <Modal open={safetyOpen} onClose={() => setSafetyOpen(false)} title="Safety">
        <ul className="mb-3">
          <li><ListRow icon={<ShieldAlert className="h-5 w-5" />} title="Call emergency services" subtitle="Dials 911" href="tel:911" /></li>
          <li><ListRow icon={<Share2 className="h-5 w-5" />} title="Share your trip" subtitle="Send a live link to someone you trust" onClick={() => { setSafetyOpen(false); share(); }} /></li>
          <li><ListRow icon={<MessageCircle className="h-5 w-5" />} title="Report a safety issue" subtitle="Our team will follow up" href={`/ride/help?trip=${trip.id}&category=safety`} /></li>
        </ul>
        <Button variant="ghost" block onClick={() => setSafetyOpen(false)}>Close</Button>
      </Modal>

      {destOpen && <DestinationDialog trip={trip} onClose={() => setDestOpen(false)} onSaved={() => { setDestOpen(false); onChange(); }} />}
      {live && d && (
        <ChatPanel tripId={trip.id} open={chatOpen} onClose={() => setChatOpen(false)} otherName={d.firstName}
          quickReplies={["I'm on my way", "I'm at the pickup", "Running 2 min late"]} />
      )}
    </Sheet>
  );
}

function DestinationDialog({ trip, onClose, onSaved }: { trip: Trip; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => api<{ places: Place[] }>(`/api/places/search?q=${encodeURIComponent(q)}`).then((r) => setResults(r.places)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  async function pick(p: Place) {
    try {
      await api(`/api/trips/${trip.id}/destination`, { body: { dropoff: { lat: p.lat, lng: p.lng, address: p.name && p.name !== p.address ? `${p.name}, ${p.address}` : p.address } } });
      onSaved();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  return (
    <Modal open onClose={onClose} title="Change destination">
      <p className="mb-2 text-sm text-text-muted">Your fare updates for the new route.</p>
      <Field label="New destination" hideLabel placeholder="Search for a place" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <ul className="my-2 max-h-60 overflow-y-auto">
        {results.map((p, i) => <li key={i}><ListRow title={p.name ?? p.address} subtitle={p.name ? p.address : undefined} onClick={() => pick(p)} /></li>)}
      </ul>
      <Button variant="ghost" block onClick={onClose}>Close</Button>
    </Modal>
  );
}
