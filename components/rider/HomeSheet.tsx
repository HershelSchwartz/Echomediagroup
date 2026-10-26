"use client";
import { useEffect, useState } from "react";
import { Briefcase, Home, MapPin, Search } from "./icons";
import { api } from "@/lib/client";
import type { Place } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { Banner } from "@/components/ui/Banner";
import { ListRow } from "@/components/ui/ListRow";
import { firstNameOf } from "./util";

type Saved = Place & { id: string; label: string };

export function HomeSheet({ name, geoStatus, onSearch, onPlace }: { name: string; geoStatus: string; onSearch: () => void; onPlace: (p: Place) => void }) {
  const [saved, setSaved] = useState<Saved[] | null>(null);
  useEffect(() => { api<{ places: Saved[] }>("/api/saved-places").then((r) => setSaved(r.places)).catch(() => setSaved([])); }, []);
  const icon = (label: string) => /home/i.test(label) ? <Home className="h-5 w-5" /> : /work/i.test(label) ? <Briefcase className="h-5 w-5" /> : <MapPin className="h-5 w-5" />;
  return (
    <Sheet label="Plan a ride">
      <h1 className="mb-3 text-xl font-bold">Hi {firstNameOf(name)}, where to?</h1>
      {(geoStatus === "denied" || geoStatus === "unavailable") && (
        <Banner variant="warning" className="mb-3">We can't see your location. You can still type a pickup address.</Banner>
      )}
      <button type="button" onClick={onSearch}
        className="flex h-14 w-full items-center gap-3 rounded-md bg-surface px-4 text-left text-lg font-semibold hover:bg-surface-2">
        <Search className="h-5 w-5" aria-hidden />
        Where to?
      </button>
      {saved && saved.length > 0 && (
        <ul className="mt-2" aria-label="Saved places">
          {saved.map((p) => (
            <li key={p.id}><ListRow icon={icon(p.label)} title={p.label} subtitle={p.address} onClick={() => onPlace(p)} /></li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
