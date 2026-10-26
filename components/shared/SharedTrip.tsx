"use client";
import { useEffect, useState } from "react";
import { api, ApiError, fmtMin } from "@/lib/client";
import { MapView, type Marker } from "@/components/MapView";
import { brand } from "@/lib/brand";

type Shared = {
  status: string; pickup: { lat: number; lng: number; address: string }; dropoff: { lat: number; lng: number; address: string };
  driver: { firstName: string; car: { make: string; model: string; colour: string; plate: string } | null; position: { lat: number; lng: number } | null } | null;
  etaS: number | null;
};

const TEXT: Record<string, string> = {
  matching: "Looking for a driver", accepted: "Driver on the way to pickup", arrived: "Driver is at the pickup",
  in_progress: "On the way", completed: "Arrived. The trip is over.", cancelled_by_rider: "This ride was cancelled",
  cancelled_by_driver: "This ride was cancelled", no_drivers: "This ride was cancelled",
};

export function SharedTrip({ token }: { token: string }) {
  const [t, setT] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () => api<{ trip: Shared }>(`/api/share/${token}`).then((r) => !stop && setT(r.trip)).catch((e: ApiError) => !stop && setError(e.message));
    load();
    const i = setInterval(load, 4000);
    return () => { stop = true; clearInterval(i); };
  }, [token]);
  if (error) return <main className="grid min-h-dvh place-items-center p-6 text-center"><p>{error}</p></main>;
  if (!t) return <main className="grid min-h-dvh place-items-center" aria-busy="true">Loading…</main>;
  const markers: Marker[] = [{ id: "p", kind: "pickup", ...t.pickup }, { id: "d", kind: "dropoff", ...t.dropoff }];
  if (t.driver?.position) markers.push({ id: "c", kind: "car", ...t.driver.position });
  return (
    <main className="flex h-dvh flex-col">
      <div className="flex-1"><MapView markers={markers} center={t.pickup} label="Live map of the ride" route={[t.pickup, t.dropoff]} /></div>
      <section className="mx-auto w-full max-w-[var(--layout-app-max)] p-4">
        <p className="text-xs text-text-muted">Shared from {brand.name}</p>
        <h1 className="text-xl font-bold" aria-live="polite">{TEXT[t.status] ?? t.status}{t.etaS != null ? ` · ${fmtMin(t.etaS)}` : ""}</h1>
        {t.driver?.car && <p className="text-sm">{t.driver.firstName} · {t.driver.car.colour} {t.driver.car.make} {t.driver.car.model} · <span className="font-mono">{t.driver.car.plate}</span></p>}
        <p className="mt-2 text-sm text-text-muted">To {t.dropoff.address}</p>
      </section>
    </main>
  );
}
