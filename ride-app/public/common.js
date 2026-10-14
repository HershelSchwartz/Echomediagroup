// Shared helpers for the rider and driver apps.
export const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };

export function loadSession(role) {
  try {
    return JSON.parse(localStorage.getItem(`echoride:${role}`));
  } catch {
    return null;
  }
}

export function saveSession(role, session) {
  try {
    if (session) localStorage.setItem(`echoride:${role}`, JSON.stringify(session));
    else localStorage.removeItem(`echoride:${role}`);
  } catch {
    // Storage can be unavailable (private mode); the session just won't persist.
  }
}

export async function api(path, { body, session, method } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (session) Object.assign(headers, { 'x-user-id': session.id, 'x-token': session.token });
  const res = await fetch(path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers,
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { code: data.error });
  return data;
}

export const money = (cents, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);

export const $ = (id) => document.getElementById(id);

export function createMap(center) {
  const map = L.map('map', { zoomControl: false }).setView([center.lat, center.lng], 14);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  return map;
}

export const pinIcon = (kind) =>
  L.divIcon({ className: '', html: `<div class="pin ${kind}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });

/** Moves or creates a marker; passing a null location removes it. */
export function placeMarker(map, marker, location, kind) {
  if (!location) {
    marker?.remove();
    return null;
  }
  if (marker) return marker.setLatLng([location.lat, location.lng]);
  return L.marker([location.lat, location.lng], { icon: pinIcon(kind) }).addTo(map);
}

export function currentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 },
    );
  });
}

export const fmtLoc = (p) => `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
