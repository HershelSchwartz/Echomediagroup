import type { ReactNode } from "react";

/** Bottom sheet over the map. Content-sized, scrolls when tall. */
export function Sheet({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section
      aria-label={label}
      className="pointer-events-auto mx-auto w-full max-w-[var(--layout-app-max)] rounded-t-lg bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-sheet"
      style={{ maxHeight: "72dvh", overflowY: "auto" }}
    >
      <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-pill bg-surface-2" />
      {children}
    </section>
  );
}
