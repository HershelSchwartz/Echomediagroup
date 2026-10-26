"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError, fmtMoney } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";

const CATS = [
  ["fare", "I was charged the wrong amount"],
  ["cancellation_fee", "I shouldn't have paid a cancellation fee"],
  ["route", "The driver took a bad route"],
  ["lost_item", "I left something in the car"],
  ["driver", "Feedback about my driver"],
  ["safety", "A safety issue"],
  ["other", "Something else"],
] as const;

type Ticket = { id: string; category: string; body: string; status: string; resolution: string | null; refund_cents: number; created_at: string };

export function Help() {
  const params = useSearchParams();
  const tripId = params.get("trip");
  const [category, setCategory] = useState<string>(params.get("category") ?? "");
  const [text, setText] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ tickets: Ticket[] }>("/api/support").then((r) => setTickets(r.tickets)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ refundedCents?: number }>("/api/support", { body: { tripId: tripId ?? undefined, category, body: text } });
      setMsg({ ok: true, text: r.refundedCents
        ? `Done. We've refunded ${fmtMoney(r.refundedCents)} to your payment method.`
        : "Thanks. We've got your request and a person will reply by email, usually within a day." });
      setText(""); setCategory("");
      load();
    } catch (err) {
      setMsg({ ok: false, text: (err as ApiError).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {category === "safety" && <Banner variant="danger">If you're in danger right now, call 911.</Banner>}
      <form onSubmit={submit} className="space-y-3">
        <fieldset>
          <legend className="mb-2 font-semibold">{tripId ? "What went wrong on this trip?" : "What do you need help with?"}</legend>
          <div className="space-y-1">
            {CATS.map(([v, l]) => (
              <label key={v} className="flex min-h-12 items-center gap-3 rounded-md px-2 hover:bg-surface">
                <input type="radio" name="cat" value={v} checked={category === v} onChange={() => setCategory(v)} className="h-5 w-5 accent-[var(--color-accent)]" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <label htmlFor="help-body" className="block font-medium">Tell us what happened</label>
        <textarea id="help-body" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000}
          className="w-full rounded-md bg-surface p-3 outline-none focus:ring-2 focus:ring-accent" />
        {msg && <Banner variant={msg.ok ? "success" : "danger"}>{msg.text}</Banner>}
        <Button type="submit" block loading={busy} disabled={!category || text.trim().length < 10}>Send</Button>
      </form>

      {tickets.length > 0 && (
        <section aria-labelledby="tickets-h">
          <h2 id="tickets-h" className="mb-2 font-semibold">Your requests</h2>
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-md bg-surface p-3 text-sm">
                <p className="font-medium">{CATS.find(([v]) => v === t.category)?.[1] ?? t.category} · {t.status === "open" ? "Open" : "Resolved"}</p>
                <p className="text-text-muted">{t.body}</p>
                {t.resolution && <p className="mt-1">{t.resolution}{t.refund_cents > 0 ? ` Refunded ${fmtMoney(t.refund_cents)}.` : ""}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
