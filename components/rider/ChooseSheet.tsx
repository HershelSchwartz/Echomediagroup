"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CreditCard, MapPin, Users } from "./icons";
import { api, ApiError, fmtMin, fmtMoney, fmtClock } from "@/lib/client";
import type { PaymentMethod, Place, Quote, Trip } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Draft } from "./SearchSheet";

export function ChooseSheet({ draft, pickingPickup, onPickPickup, onQuote, onBack, onRequested }: {
  draft: Draft; pickingPickup: boolean; onPickPickup: () => void; onQuote: (q: Quote | null) => void; onBack: () => void; onRequested: (t: Trip) => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [pmId, setPmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceNote, setPriceNote] = useState<string | null>(null);

  const stops = draft.stops.filter(Boolean) as Place[];
  const key = JSON.stringify([draft.pickup, draft.dropoff, stops]);

  useEffect(() => {
    let live = true;
    setQuote(null);
    setError(null);
    api<Quote>("/api/quotes", { body: { pickup: draft.pickup, dropoff: draft.dropoff, stops } })
      .then((q) => {
        if (!live) return;
        setQuote(q);
        onQuote(q);
        setSelected((s) => s && q.options.some((o) => o.productId === s) ? s : (q.options.find((o) => o.pickupEtaS != null) ?? q.options[0])?.productId ?? null);
      })
      .catch((e: ApiError) => live && (setError({ text: e.message, code: e.code }), onQuote(null)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    api<{ methods: PaymentMethod[] }>("/api/payment-methods").then((r) => {
      setMethods(r.methods);
      setPmId(r.methods.find((m) => m.is_default)?.id ?? r.methods[0]?.id ?? null);
    }).catch(() => setMethods([]));
  }, []);

  const opt = quote?.options.find((o) => o.productId === selected) ?? null;
  const pm = methods?.find((m) => m.id === pmId) ?? null;

  async function request() {
    if (!opt || !quote) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ trip: Trip }>("/api/trips", {
        body: {
          productId: opt.productId, pickup: draft.pickup, dropoff: draft.dropoff, stops,
          quotedFareCents: opt.fareCents, paymentMethodId: pmId ?? undefined, guest: draft.guest ?? undefined,
        },
      });
      onRequested(r.trip);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "price_changed" && typeof err.data?.fareCents === "number") {
        const fareCents = err.data.fareCents as number;
        setQuote({ ...quote, options: quote.options.map((o) => o.productId === opt.productId ? { ...o, fareCents } : o) });
        setPriceNote(err.message);
      } else setError({ text: err.message, code: err.code });
    } finally {
      setBusy(false);
    }
  }

  const arrival = quote && opt ? new Date(Date.now() + ((opt.pickupEtaS ?? 0) + quote.route.durationS) * 1000) : null;

  return (
    <Sheet label="Choose a ride">
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={onBack} className="grid h-12 w-12 place-items-center rounded-pill hover:bg-surface" aria-label="Back to addresses">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Choose a ride</h1>
        {draft.guest && <span className="flex items-center gap-1 text-sm text-text-muted"><Users className="h-4 w-4" aria-hidden />For {draft.guest.name}</span>}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-pickup" aria-hidden />
        <span className="min-w-0 flex-1 truncate"><span className="text-text-muted">Pickup: </span>{draft.pickup?.address}</span>
        <Button variant="ghost" size="sm" onClick={onPickPickup} aria-pressed={pickingPickup}>{pickingPickup ? "Done" : "Adjust"}</Button>
      </div>

      {error && (
        <Banner variant="danger" className="mb-3">
          {error.text}{" "}
          {(error.code === "no_payment_method" || error.code === "unpaid_balance") && <Link href="/ride/wallet" className="font-semibold underline">Go to Wallet</Link>}
        </Banner>
      )}
      {priceNote && <Banner variant="warning" className="mb-3">{priceNote}</Banner>}
      {quote && quote.surge > 1 && (
        <Banner variant="warning" className="mb-3">It's busy right now, so prices are a little higher than usual.</Banner>
      )}

      {!quote && !error && <div className="space-y-2" aria-busy="true"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}

      {quote && (
        <div role="radiogroup" aria-label="Ride options" className="space-y-2">
          {quote.options.map((o) => {
            const on = o.productId === selected;
            const none = o.pickupEtaS == null;
            return (
              <button
                key={o.productId}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSelected(o.productId)}
                className={`flex w-full items-center gap-3 rounded-md border-2 px-3 py-3 text-left ${on ? "border-accent bg-accent-soft" : "border-transparent bg-surface"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">{o.name}<span className="flex items-center gap-0.5 text-sm font-normal text-text-muted"><Users className="h-3.5 w-3.5" aria-hidden />{o.seats}</span></span>
                  <span className={`block text-sm ${none ? "text-warning" : "text-text-muted"}`}>
                    {none ? "No cars nearby right now" : `${fmtMin(o.pickupEtaS)} away · ${o.description}`}
                  </span>
                </span>
                <span className="text-lg font-semibold">{fmtMoney(o.fareCents, quote.city.currency)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <Link href="/ride/wallet" className="flex h-12 items-center gap-2 rounded-md px-2 hover:bg-surface">
          {pm?.kind === "cash" ? <Banknote className="h-5 w-5" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
          {methods == null ? "…" : pm ? (pm.kind === "cash" ? "Cash" : `${cap(pm.brand)} •••• ${pm.last4}`) : "Add a payment method"}
        </Link>
        {methods && methods.length > 1 && (
          <label className="text-sm">
            <span className="sr-only">Pay with</span>
            <select value={pmId ?? ""} onChange={(e) => setPmId(e.target.value)} className="h-10 rounded-md bg-surface px-2">
              {methods.map((m) => <option key={m.id} value={m.id}>{m.kind === "cash" ? "Cash" : `${cap(m.brand)} ${m.last4}`}</option>)}
            </select>
          </label>
        )}
        {arrival && <span className="text-text-muted">Arrive about {fmtClock(arrival)}</span>}
      </div>

      <Button block size="lg" className="mt-2" loading={busy} disabled={!opt || !pm || pickingPickup} onClick={request}>
        {opt ? `Request ${opt.name}` : "Request"}
      </Button>
    </Sheet>
  );
}

const cap = (s: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : "Card");
