import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageShell({ title, back, children, wide }: { title: string; back: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto min-h-dvh px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] ${wide ? "max-w-[var(--layout-admin-max)]" : "max-w-[var(--layout-app-max)]"}`}>
      <div className="mb-4 flex items-center gap-2">
        <Link href={back} className="grid h-12 w-12 place-items-center rounded-pill hover:bg-surface" aria-label="Back">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {children}
    </main>
  );
}
