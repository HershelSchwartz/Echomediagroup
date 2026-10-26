"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banknote, Check, CreditCard, Trash2 } from "./icons";
import { api, ApiError, fmtMoney } from "@/lib/client";
import type { PaymentMethod } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Skeleton } from "@/components/ui/Skeleton";

type Unpaid = { id: string; trip_id: string; kind: string; amount_cents: number; currency: string };

export function Wallet({ devCards }: { devCards: boolean }) {
  const params = useSearchParams();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [unpaid, setUnpaid] = useState<Unpaid[]>([]);
  const [stripe, setStripe] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(params.get("added") ? "Card added. It can take a few seconds to show up." : null);

  const load = useCallback(() => api<{ methods: PaymentMethod[]; unpaid: Unpaid[]; stripe: boolean }>("/api/payment-methods")
    .then((r) => { setMethods(r.methods); setUnpaid(r.unpaid); setStripe(r.stripe); })
    .catch((e: ApiError) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const r = await api<{ url?: string }>("/api/payment-methods", { body });
      if (r.url) { window.location.href = r.url; return; }
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function settle() {
    setBusy("settle");
    setError(null);
    try {
      await api("/api/payment-methods/settle", { body: {} });
      setNote("Paid. Thanks!");
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  const total = unpaid.reduce((s, u) => s + u.amount_cents, 0);

  return (
    <div className="space-y-4">
      {note && <Banner variant="success">{note}</Banner>}
      {error && <Banner variant="danger">{error}</Banner>}
      {unpaid.length > 0 && (
        <section className="rounded-md border border-danger p-3">
          <h2 className="font-semibold text-danger">Unpaid balance: {fmtMoney(total, unpaid[0].currency)}</h2>
          <p className="mb-2 text-sm">A past charge was declined. Pay it to keep riding.</p>
          <Button variant="danger" loading={busy === "settle"} onClick={settle}>Pay with default method</Button>
        </section>
      )}

      <section aria-labelledby="pm-h">
        <h2 id="pm-h" className="mb-2 font-semibold">Payment methods</h2>
        {!methods && <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
        {methods && methods.length === 0 && <p className="text-sm text-text-muted">No payment methods yet. Add one to request a ride.</p>}
        <ul className="space-y-1">
          {methods?.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md bg-surface px-3 py-2">
              {m.kind === "cash" ? <Banknote className="h-5 w-5" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
              <span className="flex-1">
                <span className="block font-medium">{m.kind === "cash" ? "Cash" : `${m.brand ? m.brand[0].toUpperCase() + m.brand.slice(1) : "Card"} •••• ${m.last4}`}</span>
                {m.kind === "card" && <span className="block text-xs text-text-muted">Expires {m.exp_month}/{m.exp_year}{m.provider === "dev" ? " · test card" : ""}</span>}
              </span>
              {m.is_default ? (
                <span className="flex items-center gap-1 text-sm text-success"><Check className="h-4 w-4" aria-hidden />Default</span>
              ) : (
                <Button size="sm" variant="ghost" loading={busy === `d${m.id}`} onClick={() => act(`d${m.id}`, { action: "default", id: m.id })}>Make default</Button>
              )}
              <Button size="sm" variant="ghost" aria-label="Remove" loading={busy === `r${m.id}`} onClick={() => act(`r${m.id}`, { action: "remove", id: m.id })}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2">
        {stripe && <Button loading={busy === "card"} onClick={() => act("card", { action: "card" })}><CreditCard className="h-5 w-5" aria-hidden />Add a card</Button>}
        {!stripe && devCards && (
          <>
            <Banner variant="warning">Development mode: card payments aren't connected, so you can add test cards.</Banner>
            <Button loading={busy === "dev4242"} onClick={() => act("dev4242", { action: "devCard", last4: "4242" })}>Add test card (works)</Button>
            <Button variant="secondary" loading={busy === "dev0002"} onClick={() => act("dev0002", { action: "devCard", last4: "0002" })}>Add test card (declines)</Button>
          </>
        )}
        {!methods?.some((m) => m.kind === "cash") && (
          <Button variant="secondary" loading={busy === "cash"} onClick={() => act("cash", { action: "cash" })}><Banknote className="h-5 w-5" aria-hidden />Pay with cash</Button>
        )}
      </section>
    </div>
  );
}
