# Note for whoever builds the APK

This zip is **Plainfare**, a ride-hailing app (rider, driver and admin screens). Please read this first.

## What it is

- A **Next.js 16 server app** with a **Postgres** database (API routes, server-side rendering, sessions).
- It is **not** a standalone mobile app. It cannot run inside an APK by itself: there is no static export,
  and every screen talks to the server's `/api/*` routes and to Postgres.
- It is already a PWA: `public/manifest.webmanifest`, icons `public/icon-192.png` and `public/icon-512.png`.

## So an APK has to wrap a hosted URL

1. **Host the server first** (free): Vercel for the app + Neon for Postgres.
   - Environment variables: `DATABASE_URL` (Neon connection string), `DEMO_MODE=1`, `CRON_SECRET` (random), then `APP_URL` = the deployed URL.
   - The `vercel-build` script in `package.json` runs migrations and seeds demo data automatically.
   - Full steps: `TESTING-ON-YOUR-PHONE.md`.
2. **Then wrap the URL as an Android app**, either:
   - **PWABuilder** (pwabuilder.com → paste the URL → Android → download): easiest, no Android Studio. Produces a Trusted Web Activity APK.
   - **Capacitor** with `server.url` set to the deployed URL, then build in Android Studio.
   - **Bubblewrap** (Google's TWA CLI) pointed at the manifest URL.
   For a TWA without the browser bar, host Digital Asset Links at `/.well-known/assetlinks.json` (PWABuilder gives you the file).

## Test logins (demo mode shows the sign-in code on screen)

- rider `+15550000100`, driver `+15550000201` (tap **Go**, keep "Simulate driving" on), admin `+15550000001`

## Permissions the Android wrapper needs

- Location (fine), for pickup and for drivers' position. Internet.

## Run locally instead

`npm install`, `cp .env.example .env.local`, `npm run db:reset`, `npm run dev` (needs Node 22+ and Postgres 16). See `README.md`.

Demo mode lets anyone with the link sign in as any number: keep test links private, and don't use it for a real launch (`replica/deploy.md`).
