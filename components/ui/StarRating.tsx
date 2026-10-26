"use client";
import { Star } from "lucide-react";
import { useRef } from "react";

export function StarRating({ value, onChange, label = "Rating" }: { value: number; onChange: (v: number) => void; label?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (n: number) => {
    const v = Math.min(5, Math.max(1, n));
    onChange(v);
    refs.current[v - 1]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex justify-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => { refs.current[n - 1] = el; }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); move(n + 1); }
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); move(n - 1); }
          }}
          className="grid h-12 w-12 place-items-center rounded-md"
        >
          <Star className={`h-9 w-9 ${n <= value ? "fill-accent text-accent" : "text-border-input"}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}
