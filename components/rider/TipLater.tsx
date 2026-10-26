"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, fmtMoney } from "@/lib/client";
import { Button } from "@/components/ui/Button";

export function TipLater({ tripId, options, currency }: { tripId: string; options: number[]; currency: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function tip(c: number) {
    setBusy(true);
    setError(null);
    try { await api(`/api/trips/${tripId}/tip`, { body: { cents: c } }); router.refresh(); }
    catch (e) { setError((e as ApiError).message); }
    finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="tip-later" className="rounded-md bg-surface p-3">
      <h2 id="tip-later" className="mb-2 font-semibold">Add a tip</h2>
      <div className="grid grid-cols-3 gap-2">
        {options.map((c) => <Button key={c} variant="secondary" className="bg-bg" disabled={busy} onClick={() => tip(c)}>{fmtMoney(c, currency)}</Button>)}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
