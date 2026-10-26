"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { StarRating } from "@/components/ui/StarRating";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { HoldButton } from "@/components/ui/HoldButton";
import { Modal } from "@/components/ui/Modal";
import { MapView } from "@/components/MapView";
import { MapPin } from "lucide-react";
import tokens from "@/replica/design/tokens.json";

/** Every primitive, every state, on one page. The design-system check before screens. */
export function DesignPreview() {
  const [stars, setStars] = useState(4);
  const [modal, setModal] = useState(false);
  const [held, setHeld] = useState(0);
  const c = { lat: 40.7359, lng: -73.9911 };
  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <h1 className="text-xl font-bold">Design system</h1>
      <section aria-labelledby="c-h">
        <h2 id="c-h" className="mb-2 font-semibold">Colour roles</h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(tokens.color).map(([k, v]) => (
            <li key={k} className="text-xs"><span className="mb-1 block h-10 rounded-sm border border-border" style={{ background: v }} />{k}<br /><span className="text-text-muted">{v}</span></li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="t-h" className="space-y-1">
        <h2 id="t-h" className="mb-2 font-semibold">Type</h2>
        <p className="text-display font-bold">Display 40</p><p className="text-xl font-bold">Heading 28</p><p className="text-lg font-semibold">Title 20</p>
        <p className="text-base">Body 16. Quick brown fox.</p><p className="text-sm text-text-muted">Small muted 14</p><p className="text-xs">Caption 12</p>
      </section>
      <section aria-labelledby="b-h" className="space-y-2">
        <h2 id="b-h" className="mb-2 font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button></div>
        <div className="flex flex-wrap gap-2"><Button size="sm">Small</Button><Button size="lg">Large</Button><Button disabled>Disabled</Button><Button loading>Loading</Button></div>
        <HoldButton onConfirm={() => setHeld((n) => n + 1)}>Hold to confirm ({held})</HoldButton>
      </section>
      <section aria-labelledby="f-h" className="grid gap-3 sm:grid-cols-2">
        <h2 id="f-h" className="font-semibold sm:col-span-2">Fields</h2>
        <Field label="Default" placeholder="Placeholder" />
        <Field label="With hint" hint="We'll text you a code" />
        <Field label="Error" defaultValue="12" error="Enter the 6-digit code" />
        <Field label="Disabled" disabled defaultValue="Can't edit" />
      </section>
      <section aria-labelledby="ba-h" className="space-y-2">
        <h2 id="ba-h" className="font-semibold">Banners</h2>
        <Banner>Info banner</Banner><Banner variant="warning">It's busy right now</Banner><Banner variant="success">Card added</Banner><Banner variant="danger">Card declined</Banner>
      </section>
      <section aria-labelledby="r-h">
        <h2 id="r-h" className="mb-2 font-semibold">Rating, rows, skeleton, modal</h2>
        <StarRating value={stars} onChange={setStars} />
        <ListRow icon={<MapPin className="h-5 w-5" />} title="Union Square" subtitle="Manhattan, NY" onClick={() => {}} />
        <ListRow title="A very long place name that keeps going and going so it must truncate cleanly at the edge" subtitle="Long subtitle text too" />
        <Skeleton className="my-2 h-12" />
        <Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button>
        <Modal open={modal} onClose={() => setModal(false)} title="Cancel this ride?"><p className="mb-3 text-sm">Modal body.</p><Button onClick={() => setModal(false)}>Close</Button></Modal>
      </section>
      <section aria-labelledby="m-h">
        <h2 id="m-h" className="mb-2 font-semibold">Map</h2>
        <div className="h-64 overflow-hidden rounded-lg">
          <MapView label="Sample map" center={c} route={[c, { lat: 40.7449, lng: -73.9876 }, { lat: 40.7527, lng: -73.9772 }]}
            markers={[{ id: "me", kind: "me", ...c }, { id: "p", kind: "pickup", ...c }, { id: "s", kind: "stop", lat: 40.7449, lng: -73.9876, label: "1" }, { id: "d", kind: "dropoff", lat: 40.7527, lng: -73.9772 }, { id: "car", kind: "car", lat: 40.739, lng: -73.995, heading: 45 }]} />
        </div>
      </section>
    </main>
  );
}
