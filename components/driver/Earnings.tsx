"use client";
import { useEffect, useState } from "react";
import { api, ApiError, fmtMoney } from "@/lib/client";
import { Skeleton } from "@/components/ui/Skeleton";
import { Banner } from "@/components/ui/Banner";

type Data = {
  currency: string; totalCents: number;
  days: { date: string; cents: number; trips: number }[];
  trips: { id: string; completedAt: string; from: string; to: string; product: string; earningsCents: number; tipCents: number }[];
  payouts: { period_start: string; period_end: string; amount_cents: number; status: string }[];
};

export function Earnings() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Data>("/api/driver/earnings").then(setD).catch((e: ApiError) => setError(e.message)); }, []);
  if (error) return <Banner variant="danger">{error}</Banner>;
  if (!d) return <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  const max = Math.max(1, ...d.days.map((x) => x.cents));
  const label = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-text-muted">Last 7 days</p>
        <p className="text-3xl font-bold">{fmtMoney(d.totalCents, d.currency)}</p>
      </section>
      <section aria-label="Earnings by day">
        <ul className="flex h-40 items-end gap-2" role="list">
          {d.days.map((x) => (
            <li key={x.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="sr-only">{label(x.date)}: {fmtMoney(x.cents, d.currency)}, {x.trips} trips</span>
              <span aria-hidden className="w-full rounded-t-sm bg-accent" style={{ height: `${(x.cents / max) * 100}%`, minHeight: x.cents ? 4 : 1 }} />
              <span aria-hidden className="text-xs text-text-muted">{label(x.date)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="trips-h">
        <h2 id="trips-h" className="mb-2 font-semibold">Trips</h2>
        {d.trips.length === 0 && <p className="text-sm text-text-muted">No trips in the last 7 days. Tap Go to start earning.</p>}
        <ul className="divide-y divide-border">
          {d.trips.map((t) => (
            <li key={t.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{t.to}</span>
                <span className="block text-text-muted">{new Date(t.completedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} · {t.product}{t.tipCents ? ` · tip ${fmtMoney(t.tipCents, d.currency)}` : ""}</span>
              </span>
              <span className="font-semibold">{fmtMoney(t.earningsCents, d.currency)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="payouts-h">
        <h2 id="payouts-h" className="mb-2 font-semibold">Payouts</h2>
        {d.payouts.length === 0 ? <p className="text-sm text-text-muted">Payouts go out weekly to your bank account once it's connected.</p> : (
          <ul className="space-y-1 text-sm">{d.payouts.map((p) => <li key={p.period_end} className="flex justify-between"><span>{p.period_start} to {p.period_end} · {p.status}</span><span>{fmtMoney(p.amount_cents, d.currency)}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
