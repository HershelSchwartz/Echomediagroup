import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
};

const V = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  secondary: "bg-surface text-text hover:bg-surface-2",
  ghost: "bg-transparent text-text hover:bg-surface",
  danger: "bg-danger text-on-danger hover:opacity-90",
};
const S = { sm: "h-9 px-3 text-sm", md: "h-12 px-4 text-base", lg: "h-14 px-6 text-lg" };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, block, className = "", children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition active:scale-[.98] disabled:opacity-45 ${V[variant]} ${S[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});
