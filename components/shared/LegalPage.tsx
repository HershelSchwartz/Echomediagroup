import Link from "next/link";
import { brand } from "@/lib/brand";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_ul]:mb-3">
      <Link href="/" className="text-sm text-text-muted hover:underline">{brand.name}</Link>
      <h1 className="mb-1 mt-4 text-xl font-bold">{title}</h1>
      <p className="mb-6 text-sm text-text-muted">Last updated {updated}. Draft for review by a lawyer in your jurisdiction before launch.</p>
      {children}
    </main>
  );
}
