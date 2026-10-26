"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

/** JSON fetch for the app's own API. Throws ApiError with the server's friendly message. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "You seem to be offline. Check your connection.", "offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(res.status, data.error ?? "Something went wrong.", data.code, data);
  }
  return data as T;
}

export function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
export function fmtMin(seconds: number | null | undefined) {
  if (seconds == null) return "";
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} min`;
}
export function fmtKm(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
export function fmtClock(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
