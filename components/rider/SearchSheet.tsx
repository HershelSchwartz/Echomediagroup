"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, Navigation, Plus, Users, X, Home, Briefcase } from "./icons";
import { api } from "@/lib/client";
import type { Place } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { ListRow } from "@/components/ui/ListRow";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";

export type Draft = { pickup: Place | null; dropoff: Place | null; stops: (Place | null)[]; guest: { name: string; phone: string } | null };
type Key = "pickup" | "dropoff" | `stop-${number}`;
type Saved = Place & { id: string; label: string };

export function SearchSheet({ draft, near, onChange, onBack, onDone }: {
  draft: Draft; near: { lat: number; lng: number } | null; onChange: (d: Draft) => void; onBack: () => void; onDone: () => void;
}) {
  const [focus, setFocus] = useState<Key>(draft.pickup ? "dropoff" : "pickup");
  const [text, setText] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [guestOpen, setGuestOpen] = useState(!!draft.guest);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { api<{ places: Saved[] }>("/api/saved-places").then((r) => setSaved(r.places)).catch(() => {}); }, []);
  useEffect(() => { inputs.current[focus]?.focus(); }, [focus]);

  const valueOf = (k: Key): Place | null => k === "pickup" ? draft.pickup : k === "dropoff" ? draft.dropoff : draft.stops[Number(k.split("-")[1])] ?? null;
  const q = text[focus] ?? "";

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (near) { params.set("lat", String(near.lat)); params.set("lng", String(near.lng)); }
      api<{ places: Place[] }>(`/api/places/search?${params}`, { signal: ctl.signal })
        .then((r) => setResults(r.places))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, near]);

  function choose(p: Place) {
    const place = { lat: p.lat, lng: p.lng, address: p.name && p.name !== p.address ? `${p.name}, ${p.address}` : p.address };
    const next: Draft = { ...draft, stops: [...draft.stops] };
    if (focus === "pickup") next.pickup = place;
    else if (focus === "dropoff") next.dropoff = place;
    else next.stops[Number(focus.split("-")[1])] = place;
    setText((t) => ({ ...t, [focus]: "" }));
    setResults(null);
    onChange(next);
    const order: Key[] = ["pickup", ...next.stops.map((_, i) => `stop-${i}` as Key), "dropoff"];
    const empty = order.find((k) => (k === "pickup" ? !next.pickup : k === "dropoff" ? !next.dropoff : !next.stops[Number(k.split("-")[1])]));
    if (empty) setFocus(empty);
    else if (!guestOpen || (next.guest?.name && next.guest.phone)) onDone();
  }

  const ready = !!draft.pickup && !!draft.dropoff && draft.stops.every(Boolean) && (!guestOpen || (!!draft.guest?.name && !!draft.guest?.phone));
  const fieldDot = (k: Key) => k === "pickup"
    ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-pill bg-pickup" />
    : k === "dropoff" ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 bg-dropoff" />
    : <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-pill border-2 border-dropoff" />;

  const field = (k: Key, label: string, placeholder: string) => {
    const v = valueOf(k);
    return (
      <div className="flex items-center gap-2">
        <Field
          ref={(el) => { inputs.current[k] = el; }}
          className="flex-1"
          label={label}
          hideLabel
          leading={fieldDot(k)}
          placeholder={placeholder}
          value={focus === k ? (text[k] ?? (v ? v.address : "")) : v?.address ?? ""}
          onFocus={() => { setFocus(k); setText((t) => ({ ...t, [k]: t[k] ?? "" })); }}
          onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))}
          autoComplete="off"
          role="combobox"
          aria-expanded={focus === k && !!results}
          aria-controls="place-results"
        />
        {k.startsWith("stop-") && (
          <Button variant="ghost" size="sm" aria-label={`Remove stop ${Number(k.split("-")[1]) + 1}`}
            onClick={() => { const i = Number(k.split("-")[1]); onChange({ ...draft, stops: draft.stops.filter((_, j) => j !== i) }); setFocus("dropoff"); }}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    );
  };

  const suggestions: { key: string; icon: React.ReactNode; title: string; subtitle: string; place: Place }[] = [];
  if (!results) {
    if (focus === "pickup" && near) suggestions.push({ key: "here", icon: <Navigation className="h-5 w-5" />, title: "Current location", subtitle: "Use where you are now", place: { ...near, address: "Current location" } });
    for (const s of saved) suggestions.push({ key: s.id, icon: /home/i.test(s.label) ? <Home className="h-5 w-5" /> : /work/i.test(s.label) ? <Briefcase className="h-5 w-5" /> : <MapPin className="h-5 w-5" />, title: s.label, subtitle: s.address, place: s });
  }

  return (
    <Sheet label="Choose pickup and drop-off">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onBack} className="grid h-12 w-12 place-items-center rounded-pill hover:bg-surface" aria-label="Back">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Plan your ride</h1>
        <Button variant="secondary" size="sm" aria-pressed={guestOpen} onClick={() => { setGuestOpen((v) => !v); if (guestOpen) onChange({ ...draft, guest: null }); }}>
          <Users className="h-4 w-4" aria-hidden />{guestOpen ? "For someone else" : "For me"}
        </Button>
      </div>

      {guestOpen && (
        <fieldset className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-border p-3">
          <legend className="px-1 text-sm text-text-muted">Who's riding? We'll text them the driver's details.</legend>
          <Field label="Rider's name" value={draft.guest?.name ?? ""} maxLength={60}
            onChange={(e) => onChange({ ...draft, guest: { name: e.target.value, phone: draft.guest?.phone ?? "" } })} />
          <Field label="Rider's mobile" type="tel" value={draft.guest?.phone ?? ""} maxLength={20}
            onChange={(e) => onChange({ ...draft, guest: { name: draft.guest?.name ?? "", phone: e.target.value } })} />
        </fieldset>
      )}

      <div className="space-y-2">
        {field("pickup", "Pickup", "Pickup location")}
        {draft.stops.map((_, i) => <div key={i}>{field(`stop-${i}`, `Stop ${i + 1}`, `Add stop ${i + 1}`)}</div>)}
        {field("dropoff", "Drop-off", "Where to?")}
      </div>
      {draft.stops.length < 2 && (
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => { onChange({ ...draft, stops: [...draft.stops, null] }); setFocus(`stop-${draft.stops.length}`); }}>
          <Plus className="h-4 w-4" aria-hidden />Add a stop
        </Button>
      )}

      <div id="place-results" role="listbox" aria-label="Suggestions" className="mt-2">
        {loading && !results && <div className="space-y-2 py-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
        {results && results.length === 0 && <p className="py-4 text-center text-sm text-text-muted">No matches. Try a street name or a landmark.</p>}
        {(results ?? []).map((p, i) => (
          <div role="option" aria-selected={false} key={`${p.lat},${p.lng},${i}`}>
            <ListRow icon={<MapPin className="h-5 w-5" />} title={p.name ?? p.address} subtitle={p.name ? p.address : undefined} onClick={() => choose(p)} />
          </div>
        ))}
        {suggestions.map((s) => (
          <div role="option" aria-selected={false} key={s.key}>
            <ListRow icon={s.icon} title={s.title} subtitle={s.subtitle} onClick={() => choose(s.place)} />
          </div>
        ))}
      </div>

      {ready && <Button block size="lg" className="mt-3" onClick={onDone}>See prices</Button>}
    </Sheet>
  );
}
