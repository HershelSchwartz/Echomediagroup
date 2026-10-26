"use client";
import { useState } from "react";
import { api, ApiError, fmtMoney } from "@/lib/client";
import type { Trip } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { StarRating } from "@/components/ui/StarRating";

const GOOD = ["Friendly", "Smooth driving", "Clean car", "Great route", "On time"];
const BAD = ["Late pickup", "Unsafe driving", "Wrong route", "Car not clean", "Rude"];

/** After the trip: rate first, then an optional tip, then done. Rider can skip either. */
export function RateSheet({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [step, setStep] = useState<"rate" | "tip">("rate");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = trip.driver;
  const options = stars >= 4 ? GOOD : BAD;

  async function submitRating() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/trips/${trip.id}/rate`, { body: { stars, tags, comment: comment || undefined } });
      if (trip.tipOptions.length) setStep("tip"); else onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "already_rated") { setStep("tip"); return; }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function tip(cents: number) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/trips/${trip.id}/tip`, { body: { cents } });
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet label="Rate your ride">
      <p className="text-sm text-text-muted">{fmtMoney(trip.fareCents, trip.currency)} charged · {trip.dropoff.address}</p>
      {step === "rate" ? (
        <>
          <h1 className="mb-3 mt-1 text-xl font-bold">How was your ride with {d?.firstName ?? "your driver"}?</h1>
          <StarRating value={stars} onChange={(v) => { setStars(v); setTags([]); }} label={`Rate ${d?.firstName ?? "your driver"}`} />
          {stars > 0 && (
            <>
              <p className="mb-2 mt-4 text-sm font-medium">{stars >= 4 ? "What went well?" : "What could be better?"}</p>
              <div className="flex flex-wrap gap-2">
                {options.map((t) => (
                  <Button key={t} size="sm" variant={tags.includes(t) ? "primary" : "secondary"} aria-pressed={tags.includes(t)}
                    onClick={() => setTags((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t])}>{t}</Button>
                ))}
              </div>
              <label className="mt-3 block text-sm font-medium" htmlFor="rate-comment">Anything else? (optional)</label>
              <textarea id="rate-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2}
                className="mt-1 w-full rounded-md bg-surface p-3 outline-none focus:ring-2 focus:ring-accent" />
            </>
          )}
          {error && <Banner variant="danger" className="mt-2">{error}</Banner>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={onDone}>Not now</Button>
            <Button loading={busy} disabled={!stars} onClick={submitRating}>Submit</Button>
          </div>
        </>
      ) : (
        <>
          <h1 className="mb-1 mt-1 text-xl font-bold">Add a tip for {d?.firstName ?? "your driver"}?</h1>
          <p className="mb-3 text-sm text-text-muted">All of it goes to your driver.</p>
          <div className="grid grid-cols-3 gap-2">
            {trip.tipOptions.map((c) => <Button key={c} variant="secondary" size="lg" disabled={busy} onClick={() => tip(c)}>{fmtMoney(c, trip.currency)}</Button>)}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = Math.round(Number(custom) * 100); if (c > 0) tip(c); }}>
            <label htmlFor="tip-custom" className="sr-only">Other amount in dollars</label>
            <input id="tip-custom" inputMode="decimal" placeholder="Other amount" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))}
              className="h-12 min-w-0 flex-1 rounded-md bg-surface px-3 outline-none focus:ring-2 focus:ring-accent" />
            <Button type="submit" variant="secondary" disabled={!Number(custom) || busy}>Tip</Button>
          </form>
          {error && <Banner variant="danger" className="mt-2">{error}</Banner>}
          <Button variant="ghost" block className="mt-2" onClick={onDone}>No tip</Button>
        </>
      )}
    </Sheet>
  );
}
