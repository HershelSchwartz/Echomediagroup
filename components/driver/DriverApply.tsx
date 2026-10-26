"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";

export function DriverApply({ name: initial }: { name: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name: initial, licenceNo: "", licenceExpiry: "", make: "", model: "", colour: "", plate: "", year: "", seats: "4" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/driver/apply", { body: {
        name: f.name, licenceNo: f.licenceNo, licenceExpiry: f.licenceExpiry,
        vehicle: { make: f.make, model: f.model, colour: f.colour, plate: f.plate, year: Number(f.year), seats: Number(f.seats) },
      } });
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-text-muted">Drive on your own schedule and keep 80% of every fare plus all of your tips.</p>
      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold">You</legend>
        <Field label="Full legal name" value={f.name} onChange={set("name")} autoComplete="name" required />
        <Field label="Driver's licence number" value={f.licenceNo} onChange={set("licenceNo")} required />
        <Field label="Licence expiry date" type="date" value={f.licenceExpiry} onChange={set("licenceExpiry")} required />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-1 font-semibold">Your car</legend>
        <Field label="Make" placeholder="Toyota" value={f.make} onChange={set("make")} required />
        <Field label="Model" placeholder="Camry" value={f.model} onChange={set("model")} required />
        <Field label="Colour" value={f.colour} onChange={set("colour")} required />
        <Field label="Plate" value={f.plate} onChange={set("plate")} required className="[&_input]:uppercase" />
        <Field label="Year" inputMode="numeric" value={f.year} onChange={set("year")} required />
        <div>
          <label htmlFor="seats" className="mb-1 block text-sm font-medium">Passenger seats</label>
          <select id="seats" value={f.seats} onChange={set("seats")} className="h-12 w-full rounded-md bg-surface px-3">
            {[2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </fieldset>
      {error && <Banner variant="danger">{error}</Banner>}
      <p className="text-xs text-text-muted">Next you'll upload your licence, insurance and photos. A background check by a licensed provider is required before your first trip.</p>
      <Button type="submit" block size="lg" loading={busy}>Continue</Button>
    </form>
  );
}
