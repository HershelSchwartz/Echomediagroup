import Link from "next/link";
import { brand } from "@/lib/brand";

// Replaced by the real landing page in replica-launch.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--layout-app-max)] flex-col justify-center gap-4 px-4">
      <h1 className="text-display font-bold">{brand.name}</h1>
      <p className="text-text-muted">{brand.tagline}</p>
      <Link href="/ride" className="inline-flex h-14 items-center justify-center rounded-md bg-accent text-lg font-semibold text-on-accent">Get a ride</Link>
      <Link href="/drive" className="inline-flex h-14 items-center justify-center rounded-md bg-surface text-lg font-semibold">Drive</Link>
    </main>
  );
}
