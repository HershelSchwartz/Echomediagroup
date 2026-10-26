import type { ReactNode } from "react";

const V = {
  info: "bg-surface text-text",
  warning: "bg-warning-soft text-warning",
  danger: "bg-bg text-danger border border-danger",
  success: "bg-surface text-success",
};

export function Banner({ variant = "info", children, className = "" }: { variant?: keyof typeof V; children: ReactNode; className?: string }) {
  return (
    <div role={variant === "danger" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${V[variant]} ${className}`}>
      {children}
    </div>
  );
}
