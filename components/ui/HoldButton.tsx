"use client";
import { useRef, useState } from "react";

/**
 * Press and hold to confirm (start/end trip), so a pocket tap can't end a trip.
 * Works with touch, mouse, and keyboard (hold Enter or Space).
 */
export function HoldButton({ children, onConfirm, ms = 700, disabled, variant = "primary" }: { children: React.ReactNode; onConfirm: () => void; ms?: number; disabled?: boolean; variant?: "primary" | "danger" }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => { timer.current = null; setHolding(false); onConfirm(); }, ms);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const bg = variant === "danger" ? "bg-danger text-on-danger" : "bg-accent text-on-accent";
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") stop(); }}
      onContextMenu={(e) => e.preventDefault()}
      aria-describedby="hold-hint"
      className={`relative h-14 w-full select-none overflow-hidden rounded-md text-lg font-semibold disabled:opacity-45 ${bg}`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 bg-white/25" style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${ms}ms linear` : "none" }} />
      <span className="relative">{children}</span>
      <span id="hold-hint" className="sr-only">Press and hold to confirm</span>
    </button>
  );
}
