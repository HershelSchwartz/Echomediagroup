"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";

/** A driver who was rejected or paused can ask a person to look again, with their side of it. */
export function AccountReview() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/support", { body: { category: "account_review", body: text } });
      setMsg({ ok: true, text: "Sent. A person on our team will review your account and reply within 2 business days." });
      setText("");
    } catch (err) {
      setMsg({ ok: false, text: (err as ApiError).message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send} className="mb-6 space-y-2">
      <label htmlFor="review-body" className="block font-semibold">Ask for a review</label>
      <p className="text-sm text-text-muted">Tell us your side. A person reads every request; it's never decided by an automated system alone.</p>
      <textarea id="review-body" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
        className="w-full rounded-md bg-surface p-3 outline-none focus:ring-2 focus:ring-accent" />
      {msg && <Banner variant={msg.ok ? "success" : "danger"}>{msg.text}</Banner>}
      <Button type="submit" loading={busy} disabled={text.trim().length < 10}>Send for review</Button>
    </form>
  );
}
