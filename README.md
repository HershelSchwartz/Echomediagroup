# Plainfare

A ride-hailing app: rider app (`/ride`), driver app (`/drive`), operations console (`/admin`), public
trip-sharing pages (`/t/...`) and a landing page (`/`). Next.js + Postgres. Built with the Replica
skill pack; planning docs, test plan, bugs, parity, brand and launch material are in `replica/`.

## Run it locally

Needs Node 22+ and Postgres 16.

```bash
npm install
cp .env.example .env.local          # DATABASE_URL and DEV_SHOW_OTP=1 are enough to start
npm run db:reset                    # migrate + seed (one city, 3 ride types, demo users)
npm run dev                         # http://localhost:3000
```

With no provider keys, everything still works: sign-in codes show on screen, maps use a built-in
schematic, address search uses seeded landmarks, cards are test cards, and emails/SMS are logged to
Operations → Sent messages.

Demo accounts (fictional 555 numbers): admin `+15550000001`, rider `+15550000100`, drivers
`+15550000201` to `+15550000205`. Open the driver app in a second browser, tap **Go**, and leave
"Simulate driving" on to watch the car move.

## Tests

```bash
npm run test:unit                   # pricing and geo rules
npx playwright test                 # 18 end-to-end flows, axe accessibility on every screen
```

If Playwright can't find its browser, point it at an installed Chromium: `PW_CHROMIUM=/path/to/chrome npx playwright test`.

## Test it on your phone

See `TESTING-ON-YOUR-PHONE.md`: a free Neon + Vercel test link with `DEMO_MODE=1`, and an Android APK via PWABuilder.

## Deploy

See `replica/deploy.md`. Short version: Vercel + Neon, env vars from `.env.example`, Stripe webhook at
`/api/webhooks/stripe`, hourly cron from `vercel.json`.
