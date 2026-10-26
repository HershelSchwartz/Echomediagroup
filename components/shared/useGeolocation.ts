"use client";
import { useEffect, useState } from "react";

export type GeoState = { pos: { lat: number; lng: number; heading: number | null } | null; status: "pending" | "ok" | "denied" | "unavailable" };

/** Watches the device position. Status tells the UI whether to ask for a typed address instead. */
export function useGeolocation(enabled = true): GeoState {
  const [state, setState] = useState<GeoState>({ pos: null, status: "pending" });
  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) { setState({ pos: null, status: "unavailable" }); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => setState({ pos: { lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading ?? null }, status: "ok" }),
      (e) => setState((s) => ({ pos: s.pos, status: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable" })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
  return state;
}
