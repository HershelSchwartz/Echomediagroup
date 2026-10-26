"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

export type Marker = { id: string; kind: "me" | "pickup" | "dropoff" | "stop" | "car"; lat: number; lng: number; heading?: number | null; label?: string };
type Props = { markers: Marker[]; route?: LatLng[]; center: LatLng; onPick?: (p: LatLng) => void; label: string };

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Map with one API and two renderers: Mapbox tiles through Leaflet when a token is set,
 * otherwise a schematic SVG map that needs no network. The map is decoration: every fact
 * it shows is also written out in the sheet, so it is hidden from screen readers.
 */
export function MapView(props: Props) {
  return TOKEN ? <TileMap {...props} /> : <SchematicMap {...props} />;
}

function bounds(points: LatLng[], center: LatLng) {
  const pts = points.length ? points : [center];
  let minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat));
  let minLng = Math.min(...pts.map((p) => p.lng)), maxLng = Math.max(...pts.map((p) => p.lng));
  const minSpan = 0.012;
  if (maxLat - minLat < minSpan) { const c = (maxLat + minLat) / 2; minLat = c - minSpan / 2; maxLat = c + minSpan / 2; }
  if (maxLng - minLng < minSpan) { const c = (maxLng + minLng) / 2; minLng = c - minSpan / 2; maxLng = c + minSpan / 2; }
  const pLat = (maxLat - minLat) * 0.18, pLng = (maxLng - minLng) * 0.18;
  return { minLat: minLat - pLat, maxLat: maxLat + pLat, minLng: minLng - pLng, maxLng: maxLng + pLng };
}

function SchematicMap({ markers, route, center, onPick, label }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const b = useMemo(() => bounds([...markers, ...(route ?? [])], center), [markers, route, center]);
  const kx = Math.cos((((b.minLat + b.maxLat) / 2) * Math.PI) / 180);
  const W = (b.maxLng - b.minLng) * kx * 100000;
  const H = (b.maxLat - b.minLat) * 100000;
  const x = (lng: number) => (lng - b.minLng) * kx * 100000;
  const y = (lat: number) => (b.maxLat - lat) * 100000;
  const r = Math.max(W, H) / 60;

  const step = 0.0025;
  const streets: { k: string; d: string; major: boolean }[] = [];
  for (let la = Math.ceil(b.minLat / step) * step, i = 0; la < b.maxLat; la += step, i++) {
    streets.push({ k: `a${la.toFixed(4)}`, d: `M0 ${y(la)}H${W}`, major: Math.round(la / step) % 4 === 0 });
  }
  for (let lo = Math.ceil(b.minLng / step) * step; lo < b.maxLng; lo += step) {
    streets.push({ k: `o${lo.toFixed(4)}`, d: `M${x(lo)} 0V${H}`, major: Math.round(lo / step) % 4 === 0 });
  }

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick || !ref.current) return;
    const pt = ref.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ref.current.getScreenCTM()!.inverse());
    onPick({ lat: b.maxLat - p.y / 100000, lng: b.minLng + p.x / (kx * 100000) });
  };

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full bg-map-land ${onPick ? "cursor-crosshair" : ""}`}
      onClick={pick}
      data-testid="map"
    >
      <g stroke="var(--color-map-road)" strokeLinecap="round">
        {streets.map((s) => <path key={s.k} d={s.d} strokeWidth={s.major ? r * 0.55 : r * 0.28} />)}
      </g>
      {route && route.length > 1 && (
        <polyline
          points={route.map((p) => `${x(p.lng)},${y(p.lat)}`).join(" ")}
          fill="none" stroke="var(--color-route)" strokeWidth={r * 0.4} strokeLinejoin="round" strokeLinecap="round"
        />
      )}
      {markers.map((m) => {
        const cx = x(m.lng), cy = y(m.lat);
        if (m.kind === "me") return (
          <g key={m.id}>
            <circle className="pulse-ring" cx={cx} cy={cy} r={r * 1.4} fill="var(--color-accent)" opacity=".25" />
            <circle cx={cx} cy={cy} r={r * 0.6} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={r * 0.25} />
          </g>
        );
        if (m.kind === "pickup") return <circle key={m.id} cx={cx} cy={cy} r={r * 0.7} fill="var(--color-pickup)" stroke="var(--color-bg)" strokeWidth={r * 0.3} />;
        if (m.kind === "dropoff") return <rect key={m.id} x={cx - r * 0.65} y={cy - r * 0.65} width={r * 1.3} height={r * 1.3} fill="var(--color-dropoff)" stroke="var(--color-bg)" strokeWidth={r * 0.3} />;
        if (m.kind === "stop") return (
          <g key={m.id}>
            <circle cx={cx} cy={cy} r={r * 0.75} fill="var(--color-bg)" stroke="var(--color-dropoff)" strokeWidth={r * 0.25} />
            <text x={cx} y={cy + r * 0.35} textAnchor="middle" fontSize={r} fontWeight="700" fill="var(--color-text)">{m.label}</text>
          </g>
        );
        return (
          <g key={m.id} transform={`translate(${cx} ${cy}) rotate(${m.heading ?? 0})`}>
            <rect x={-r * 0.6} y={-r} width={r * 1.2} height={r * 2} rx={r * 0.35} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={r * 0.2} />
            <rect x={-r * 0.4} y={-r * 0.7} width={r * 0.8} height={r * 0.45} rx={r * 0.1} fill="var(--color-bg)" opacity=".8" />
          </g>
        );
      })}
    </svg>
  );
}

function TileMap({ markers, route, center, onPick, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const L = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      L.current = leaflet;
      map.current = leaflet.map(el.current, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 14);
      leaflet.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${TOKEN}`, {
        tileSize: 512, zoomOffset: -1, maxZoom: 19,
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      map.current.on("click", (e: any) => pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      layer.current = leaflet.layerGroup().addTo(map.current);
      setReady(true);
    })();
    return () => { cancelled = true; map.current?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const lf = L.current;
    layer.current.clearLayers();
    const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    if (route && route.length > 1) lf.polyline(route.map((p) => [p.lat, p.lng]), { color: css("--color-route"), weight: 5 }).addTo(layer.current);
    for (const m of markers) {
      const color = m.kind === "pickup" ? css("--color-pickup") : m.kind === "car" || m.kind === "me" ? css("--color-accent") : css("--color-dropoff");
      lf.circleMarker([m.lat, m.lng], { radius: m.kind === "car" ? 9 : 7, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }).addTo(layer.current);
    }
    const pts = [...markers, ...(route ?? [])];
    if (pts.length > 1) map.current.fitBounds(lf.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16 });
    else map.current.setView([center.lat, center.lng], 15);
  }, [ready, markers, route, center]);

  return <div ref={el} role="img" aria-label={label} className="h-full w-full bg-map-land" data-testid="map" />;
}
