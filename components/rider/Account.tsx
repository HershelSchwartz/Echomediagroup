"use client";
import { useEffect, useState } from "react";
import { MapPin, Star, Trash2 } from "./icons";
import { api, ApiError } from "@/lib/client";
import type { Place } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { ListRow } from "@/components/ui/ListRow";

type Saved = Place & { id: string; label: string };

export function Account({ user }: { user: { name: string; email: string; phone: string; rating: number | null } }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [places, setPlaces] = useState<Saved[]>([]);
  const [label, setLabel] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Place[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => api<{ places: Saved[] }>("/api/saved-places").then((r) => setPlaces(r.places)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => api<{ places: Place[] }>(`/api/places/search?q=${encodeURIComponent(q)}`).then((r) => setHits(r.places)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    try { await api("/api/me", { method: "PATCH", body: { name, email } }); setMsg({ ok: true, text: "Saved." }); }
    catch (err) { setMsg({ ok: false, text: (err as ApiError).message }); }
    finally { setBusy(null); }
  }
  async function addPlace(p: Place) {
    try {
      await api("/api/saved-places", { body: { label: label.trim() || "Saved", address: p.name && p.name !== p.address ? `${p.name}, ${p.address}` : p.address, lat: p.lat, lng: p.lng } });
      setLabel(""); setQ(""); setHits([]); load();
    } catch (err) { setMsg({ ok: false, text: (err as ApiError).message }); }
  }
  async function removePlace(id: string) {
    await api(`/api/saved-places?id=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  }
  async function signOut(everywhere: boolean) {
    await api("/api/auth/logout", { body: { everywhere } }).catch(() => {});
    window.location.href = "/login";
  }
  async function deleteAccount() {
    setBusy("delete");
    try { await api("/api/me", { method: "DELETE" }); window.location.href = "/"; }
    catch (err) { setMsg({ ok: false, text: (err as ApiError).message }); setConfirmDelete(false); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-8">
      {msg && <Banner variant={msg.ok ? "success" : "danger"}>{msg.text}</Banner>}
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-text-muted">{user.phone}{user.rating != null && <span className="ml-2 inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-accent" aria-hidden />{user.rating.toFixed(2)} rider rating</span>}</p>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
        <Field label="Email for receipts" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} />
        <Button type="submit" loading={busy === "save"}>Save</Button>
      </form>

      <section aria-labelledby="saved-h" className="space-y-2">
        <h2 id="saved-h" className="font-semibold">Saved places</h2>
        <ul>
          {places.map((p) => (
            <li key={p.id}>
              <ListRow icon={<MapPin className="h-5 w-5" />} title={p.label} subtitle={p.address}
                trailing={<Button size="sm" variant="ghost" aria-label={`Remove ${p.label}`} onClick={() => removePlace(p.id)}><Trash2 className="h-4 w-4" aria-hidden /></Button>} />
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Field label="Label" placeholder="Gym" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} />
          <Field label="Address" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul>{hits.map((h, i) => <li key={i}><ListRow title={h.name ?? h.address} subtitle={h.name ? h.address : undefined} onClick={() => addPlace(h)} /></li>)}</ul>
      </section>

      <section className="grid gap-2">
        <Button variant="secondary" onClick={() => signOut(false)}>Sign out</Button>
        <Button variant="secondary" onClick={() => signOut(true)}>Sign out on all devices</Button>
        <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>Delete account</Button>
      </section>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your account?">
        <p className="mb-4 text-sm">This removes your profile, saved places and payment methods and signs you out everywhere. Past trip records are kept without your name for accounting. This can't be undone.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep account</Button>
          <Button variant="danger" loading={busy === "delete"} onClick={deleteAccount}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
