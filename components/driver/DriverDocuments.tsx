"use client";
import { useEffect, useState } from "react";
import { Check, Upload } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";

const KINDS = [["licence", "Driver's licence"], ["insurance", "Proof of insurance"], ["vehicle_photo", "Photo of your car"], ["profile_photo", "Profile photo"]] as const;
type Doc = { id: string; kind: string; filename: string; status: string };

export function DriverDocuments() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api<{ documents: Doc[] }>("/api/driver/documents").then((r) => setDocs(r.documents)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function upload(kind: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) { setError("That file is over 5 MB. Try a smaller photo."); return; }
    setBusy(kind);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    try {
      const res = await fetch("/api/driver/documents", { method: "POST", body: fd });
      if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error ?? "Upload failed");
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <Banner variant="danger">{error}</Banner>}
      <ul className="space-y-2">
        {KINDS.map(([kind, label]) => {
          const d = docs.find((x) => x.kind === kind);
          return (
            <li key={kind}>
              <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md bg-surface px-3 focus-within:ring-2 focus-within:ring-accent">
                <span className="grid h-10 w-10 place-items-center rounded-pill bg-bg" aria-hidden>
                  {busy === kind ? <Spinner /> : d ? <Check className="h-5 w-5 text-success" /> : <Upload className="h-5 w-5" />}
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-sm text-text-muted">{d ? `${d.filename} · ${d.status === "pending" ? "in review" : d.status}` : "JPEG, PNG or PDF, up to 5 MB"}</span>
                </span>
                <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={(e) => upload(kind, e.target.files?.[0])} />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
