"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, fmtMoney } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { brand } from "@/lib/brand";

type Overview = {
  live: { id: string; status: string; pickup_address: string; dropoff_address: string; requested_at: string; quoted_fare_cents: number; currency: string; rider_name: string | null; driver_name: string | null; product_name: string }[];
  drivers: { id: string; name: string | null; phone: string; status: string; online: boolean; last_seen_at: string | null; licence_no: string; licence_expiry: string; review_note: string | null; rating: number | null; make: string | null; model: string | null; year: number | null; plate: string | null; seats: number | null; documents: { id: string; kind: string; filename: string; status: string }[] }[];
  tickets: { id: string; trip_id: string | null; category: string; body: string; created_at: string; user_name: string | null; final_fare_cents: number | null; cancel_fee_cents: number | null; currency: string | null }[];
  today: { completed: number; cancelled: number; unmatched: number; gross_cents: number };
  products: Record<string, any>[];
  city: { id: string; name: string; surge_multiplier: string } | undefined;
};
type Tab = "live" | "drivers" | "tickets" | "pricing" | "messages";

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("live");
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<Overview>("/api/admin/overview").then(setD).catch((e: ApiError) => setError(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const tabs: [Tab, string, number?][] = [
    ["live", "Live trips", d?.live.length], ["drivers", "Drivers", d?.drivers.filter((x) => x.status === "pending").length],
    ["tickets", "Support", d?.tickets.length], ["pricing", "Pricing"], ["messages", "Sent messages"],
  ];

  return (
    <main className="mx-auto max-w-[var(--layout-admin-max)] px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">{brand.name} operations · {d?.city?.name}</h1>
        {d && (
          <p className="text-sm text-text-muted">
            Today: {d.today.completed} completed · {d.today.cancelled} cancelled · {d.today.unmatched} unmatched · {fmtMoney(d.today.gross_cents)} in fares
          </p>
        )}
      </header>
      {error && <Banner variant="danger" className="mb-3">{error}</Banner>}
      <div role="tablist" aria-label="Sections" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} aria-controls={`panel-${k}`} id={`tab-${k}`} onClick={() => setTab(k)}
            className={`h-11 rounded-t-md px-4 text-sm font-semibold ${tab === k ? "bg-accent text-on-accent" : "hover:bg-surface"}`}>
            {label}{n ? ` (${n})` : ""}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {!d ? <p className="text-text-muted">Loading…</p> :
          tab === "live" ? <LiveTrips d={d} /> :
          tab === "drivers" ? <Drivers d={d} onChange={load} /> :
          tab === "tickets" ? <Tickets d={d} onChange={load} /> :
          tab === "pricing" ? <Pricing d={d} onChange={load} /> : <Messages />}
      </section>
    </main>
  );
}

const th = "sticky top-0 bg-bg px-2 py-2 text-left text-xs font-semibold uppercase text-text-muted";
const td = "border-t border-border px-2 py-2 align-top text-sm";

function LiveTrips({ d }: { d: Overview }) {
  if (!d.live.length) return <p className="text-text-muted">No trips in progress.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr><th className={th}>Status</th><th className={th}>Rider</th><th className={th}>Driver</th><th className={th}>Route</th><th className={th}>Fare</th><th className={th}>Requested</th></tr></thead>
        <tbody>
          {d.live.map((t) => (
            <tr key={t.id}>
              <td className={td}>{t.status.replace("_", " ")}</td><td className={td}>{t.rider_name}</td><td className={td}>{t.driver_name ?? "—"}</td>
              <td className={td}>{t.pickup_address} → {t.dropoff_address}<br /><span className="text-text-muted">{t.product_name}</span></td>
              <td className={td}>{fmtMoney(t.quoted_fare_cents, t.currency)}</td><td className={td}>{new Date(t.requested_at).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Drivers({ d, onChange }: { d: Overview; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function review(id: string, status: string) {
    const note = status === "approved" ? undefined : window.prompt("Reason the driver will see (required)") ?? undefined;
    if (status !== "approved" && !note) return;
    setBusy(id + status);
    setError(null);
    try { await api(`/api/admin/drivers/${id}/review`, { body: { status, note } }); onChange(); }
    catch (e) { setError((e as ApiError).message); }
    finally { setBusy(null); }
  }
  return (
    <div className="overflow-x-auto">
      {error && <Banner variant="danger" className="mb-2">{error}</Banner>}
      <table className="w-full">
        <thead><tr><th className={th}>Driver</th><th className={th}>Status</th><th className={th}>Vehicle</th><th className={th}>Licence</th><th className={th}>Documents</th><th className={th}>Actions</th></tr></thead>
        <tbody>
          {d.drivers.map((x) => (
            <tr key={x.id}>
              <td className={td}>{x.name}<br /><span className="text-text-muted">{x.phone}{x.rating != null ? ` · ★ ${x.rating.toFixed(2)}` : ""}</span></td>
              <td className={td}>{x.status}{x.online ? " · online" : ""}</td>
              <td className={td}>{x.make ? `${x.year} ${x.make} ${x.model}, ${x.seats} seats` : "—"}<br /><span className="font-mono">{x.plate}</span></td>
              <td className={td}>{x.licence_no}<br /><span className="text-text-muted">exp. {String(x.licence_expiry).slice(0, 10)}</span></td>
              <td className={td}>
                {x.documents.length === 0 ? <span className="text-text-muted">None</span> : (
                  <ul>{x.documents.map((doc) => <li key={doc.id}><a className="underline" href={`/api/admin/drivers/${x.id}/documents/${doc.id}`} target="_blank" rel="noreferrer">{doc.kind.replace("_", " ")}</a> · {doc.status}</li>)}</ul>
                )}
              </td>
              <td className={td}>
                <div className="flex flex-wrap gap-1">
                  {x.status !== "approved" && <Button size="sm" loading={busy === x.id + "approved"} onClick={() => review(x.id, "approved")}>Approve</Button>}
                  {x.status === "pending" && <Button size="sm" variant="secondary" loading={busy === x.id + "rejected"} onClick={() => review(x.id, "rejected")}>Reject</Button>}
                  {x.status === "approved" && <Button size="sm" variant="danger" loading={busy === x.id + "suspended"} onClick={() => review(x.id, "suspended")}>Suspend</Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tickets({ d, onChange }: { d: Overview; onChange: () => void }) {
  const [open, setOpen] = useState<Overview["tickets"][number] | null>(null);
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function resolve() {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/tickets/${open.id}/resolve`, { body: { resolution, refundCents: Math.round(Number(refund || 0) * 100) } });
      setOpen(null); setResolution(""); setRefund(""); onChange();
    } catch (e) { setError((e as ApiError).message); }
    finally { setBusy(false); }
  }
  if (!d.tickets.length) return <p className="text-text-muted">No open requests.</p>;
  return (
    <>
      <ul className="space-y-2">
        {d.tickets.map((t) => (
          <li key={t.id} className="rounded-md bg-surface p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.category.replace("_", " ")} · {t.user_name}</p>
                <p className="text-text-muted">{new Date(t.created_at).toLocaleString()}{t.final_fare_cents != null ? ` · fare ${fmtMoney(t.final_fare_cents, t.currency ?? "usd")}` : ""}{t.cancel_fee_cents ? ` · cancel fee ${fmtMoney(t.cancel_fee_cents, t.currency ?? "usd")}` : ""}</p>
                <p className="mt-1">{t.body}</p>
              </div>
              <Button size="sm" onClick={() => setOpen(t)}>Resolve</Button>
            </div>
          </li>
        ))}
      </ul>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Resolve request">
        <label htmlFor="res" className="mb-1 block text-sm font-medium">Reply to the rider</label>
        <textarea id="res" rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} className="mb-2 w-full rounded-md bg-surface p-2" />
        {open?.trip_id && (
          <>
            <label htmlFor="refund" className="mb-1 block text-sm font-medium">Refund in dollars (optional)</label>
            <input id="refund" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value.replace(/[^\d.]/g, ""))} className="mb-2 h-10 w-full rounded-md bg-surface px-2" />
          </>
        )}
        {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
          <Button loading={busy} disabled={resolution.trim().length < 3} onClick={resolve}>Send</Button>
        </div>
      </Modal>
    </>
  );
}

const PRICE_FIELDS: [string, string, "cents" | "min"][] = [
  ["base_cents", "Base", "cents"], ["per_km_cents", "Per km", "cents"], ["per_min_cents", "Per minute", "cents"],
  ["min_fare_cents", "Minimum fare", "cents"], ["booking_fee_cents", "Booking fee", "cents"], ["wait_grace_min", "Free wait (min)", "min"],
  ["wait_per_min_cents", "Wait per minute", "cents"], ["cancel_free_min", "Free cancel window (min)", "min"],
  ["cancel_fee_cents", "Cancellation fee", "cents"], ["no_show_min", "No-show after (min)", "min"],
];

function Pricing({ d, onChange }: { d: Overview; onChange: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [surge, setSurge] = useState(d.city?.surge_multiplier ?? "1.00");
  async function save(id: string, form: HTMLFormElement) {
    const fd = new FormData(form);
    const body: Record<string, number> = {};
    for (const [k, , kind] of PRICE_FIELDS) body[k] = kind === "cents" ? Math.round(Number(fd.get(k)) * 100) : Number(fd.get(k));
    try { await api(`/api/admin/products/${id}`, { method: "PATCH", body }); setMsg({ ok: true, text: "Prices saved. New quotes use them right away." }); onChange(); }
    catch (e) { setMsg({ ok: false, text: (e as ApiError).message }); }
  }
  async function saveSurge() {
    try { await api(`/api/admin/cities/${d.city!.id}`, { method: "PATCH", body: { surge: Number(surge) } }); setMsg({ ok: true, text: "Busy-time multiplier saved." }); onChange(); }
    catch (e) { setMsg({ ok: false, text: (e as ApiError).message }); }
  }
  return (
    <div className="space-y-6">
      {msg && <Banner variant={msg.ok ? "success" : "danger"}>{msg.text}</Banner>}
      <div className="flex items-end gap-2">
        <label className="text-sm font-medium">City-wide multiplier (1.00 to 3.00)
          <input type="number" min={1} max={3} step={0.05} value={surge} onChange={(e) => setSurge(e.target.value)} className="mt-1 block h-10 w-32 rounded-md bg-surface px-2" />
        </label>
        <Button size="sm" onClick={saveSurge}>Save</Button>
      </div>
      {d.products.map((p) => (
        <form key={p.id} onSubmit={(e) => { e.preventDefault(); save(p.id, e.currentTarget); }} className="rounded-md border border-border p-3">
          <h2 className="mb-2 font-semibold">{p.name} · {p.seats} seats</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PRICE_FIELDS.map(([k, label, kind]) => (
              <label key={k} className="text-xs font-medium">{label}{kind === "cents" ? " ($)" : ""}
                <input name={k} type="number" min={0} step={kind === "cents" ? 0.01 : 1} defaultValue={kind === "cents" ? (p[k] / 100).toFixed(2) : p[k]}
                  className="mt-1 block h-10 w-full rounded-md bg-surface px-2 text-sm" />
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" className="mt-2">Save {p.name}</Button>
        </form>
      ))}
    </div>
  );
}

function Messages() {
  const [rows, setRows] = useState<{ id: string; channel: string; to_addr: string; subject: string | null; body: string; status: string; created_at: string }[] | null>(null);
  useEffect(() => { api<{ messages: any[] }>("/api/admin/outbox").then((r) => setRows(r.messages)).catch(() => setRows([])); }, []);
  if (!rows) return <p className="text-text-muted">Loading…</p>;
  if (!rows.length) return <p className="text-text-muted">Nothing sent yet.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((m) => (
        <li key={m.id} className="rounded-md bg-surface p-3">
          <p className="font-medium">{m.channel.toUpperCase()} to {m.to_addr} · {m.status}{m.status === "logged" ? " (no provider set, not delivered)" : ""}</p>
          {m.subject && <p className="font-semibold">{m.subject}</p>}
          <pre className="whitespace-pre-wrap font-sans text-text-muted">{m.body}</pre>
        </li>
      ))}
    </ul>
  );
}
