import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { loadTripFor, tripView } from "@/lib/trips";
import { money } from "@/lib/money";
import { PageShell } from "@/components/shared/PageShell";
import { MapView } from "@/components/MapView";
import { TipLater } from "@/components/rider/TipLater";

export const metadata: Metadata = { title: "Trip details" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { fare: "Fare", tip: "Tip", cancellation: "Cancellation fee", refund: "Refund" };

export default async function TripDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getUser())!;
  const raw = await loadTripFor(user, id).catch(() => null);
  if (!raw) notFound();
  const t = await tripView(raw, user);
  const [city] = await sql`select timezone from cities where id = ${raw.city_id}`;
  const crumbs = await sql`select lat, lng from trip_locations where trip_id = ${id} and at >= coalesce(${raw.started_at}, now()) order by at`;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-US", { timeZone: city.timezone, dateStyle: "medium", timeStyle: "short" }) : "";
  const route = crumbs.length > 1 ? crumbs.map((c) => ({ lat: c.lat, lng: c.lng })) : [t.pickup, ...t.stops.map((s) => ({ lat: s.lat as number, lng: s.lng as number })), t.dropoff];
  return (
    <PageShell title="Trip details" back="/ride/activity">
      <div className="mb-4 h-48 overflow-hidden rounded-lg">
        <MapView center={t.pickup} label="Map of the trip route" route={route}
          markers={[{ id: "p", kind: "pickup", ...t.pickup }, { id: "d", kind: "dropoff", ...t.dropoff }]} />
      </div>
      <p className="text-sm text-text-muted">{fmt(t.times.requested)} · {t.product.name}{t.driver ? ` with ${t.driver.firstName}` : ""}</p>
      <dl className="my-3 space-y-1">
        <div><dt className="sr-only">From</dt><dd className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 shrink-0 rounded-pill bg-pickup" />{t.pickup.address}</dd></div>
        {t.stops.map((s) => <div key={s.seq}><dt className="sr-only">Stop</dt><dd className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 shrink-0 rounded-pill border border-dropoff" />{s.address}</dd></div>)}
        <div><dt className="sr-only">To</dt><dd className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 shrink-0 bg-dropoff" />{t.dropoff.address}</dd></div>
      </dl>

      <h2 className="mb-2 mt-6 font-semibold">Payment</h2>
      {t.status === "completed" && (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Trip fare</dt><dd>{money(t.quotedFareCents, t.currency)}</dd></div>
          {t.waitFeeCents > 0 && <div className="flex justify-between"><dt>Wait time</dt><dd>{money(t.waitFeeCents, t.currency)}</dd></div>}
          {t.tipCents > 0 && <div className="flex justify-between"><dt>Tip</dt><dd>{money(t.tipCents, t.currency)}</dd></div>}
        </dl>
      )}
      <ul className="mt-2 space-y-1 text-sm">
        {t.charges.map((c, i) => (
          <li key={i} className="flex justify-between border-t border-border pt-1">
            <span>{KIND[c.kind] ?? c.kind}{c.status === "failed" ? " · declined" : c.status === "pending" ? " · processing" : ""}</span>
            <span className={c.status === "failed" ? "text-danger" : ""}>{money(c.amountCents, t.currency)}</span>
          </li>
        ))}
        {t.charges.length === 0 && <li className="text-text-muted">No charges for this trip.</li>}
      </ul>
      {t.charges.some((c) => c.status === "failed") && (
        <p className="mt-2 text-sm"><Link href="/ride/wallet" className="font-semibold underline">Pay now in Wallet</Link></p>
      )}

      <div className="mt-6 grid gap-2">
        <Link href={`/ride/help?trip=${t.id}`} className="inline-flex h-12 items-center justify-center rounded-md bg-surface font-semibold">Get help with this trip</Link>
        {t.role === "rider" && t.tipOptions.length > 0 && <TipLater tripId={t.id} options={t.tipOptions} currency={t.currency} />}
      </div>
    </PageShell>
  );
}
