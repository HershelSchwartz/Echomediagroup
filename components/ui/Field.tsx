import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hideLabel?: boolean; error?: string | null; hint?: string; leading?: ReactNode };

export const Field = forwardRef<HTMLInputElement, Props>(function Field({ label, hideLabel, error, hint, leading, className = "", id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = [error ? `${fid}-err` : null, hint ? `${fid}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={fid} className={hideLabel ? "sr-only" : "mb-1 block text-sm font-medium text-text"}>{label}</label>
      <div className={`flex h-12 items-center gap-2 rounded-md border bg-surface px-3 focus-within:border-border-input ${error ? "border-danger" : "border-transparent"}`}>
        {leading}
        <input
          ref={ref}
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full w-full min-w-0 bg-transparent text-base text-text outline-none placeholder:text-text-muted"
          {...rest}
        />
      </div>
      {hint && !error && <p id={`${fid}-hint`} className="mt-1 text-xs text-text-muted">{hint}</p>}
      {error && <p id={`${fid}-err`} className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
});
