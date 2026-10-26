# Deploy checklist: Plainfare

Date: 2026-10-26  Commit: b87be15  Go from user: **not yet**

Nothing has been deployed. Deploying needs your accounts, keys and domain, and your go-ahead. Below is
what passed, what blocks, and the exact steps for you.

## Preflight (all must pass)

- [x] e2e suite green: **18 passed / 18** (`npm run test:e2e`), with axe scans and console/5xx checks on every screen; unit **13 / 13**
- [x] no open S1 or S2 bugs (`replica/bugs.md`: 5 found, 5 fixed)
- [ ] **parity: must-haves 22 / 25**, feature score 87.3. Partial: driver background location (needs native driver app), push notifications (native apps), Stripe card charges (needs your test keys and one end-to-end run). **Blocks a public launch.** A closed pilot with a few drivers who keep the app open is possible now.
- [x] rebrand sweep clean (`sweep.py` exit 0)
- [x] store listing passes (`listing.py`: 0 errors, 0 warnings). Store submission waits for the native apps.
- [x] production build passes (`next build`); `npm audit`: 0 vulnerabilities
- [~] privacy policy and terms live at `/privacy` and `/terms`, every processor listed. **Drafts: need a lawyer's review**, and the operator entity and driver agreement filled in.
- [~] account deletion built (Account → Delete account: removes profile, photo, places, payment methods, messages, sessions). Not yet covered by an automated test; try it once by hand before launch
- [~] favicon, titles, manifest, email and SMS text use the brand; **final logo and OG image still to make** (logo brief in `replica/brand.md`)
- [ ] **name screening checks not run** (USPTO, EUIPO, domains, stores, handles); see `replica/brand.md`

## Production (you do these; Claude never creates accounts or handles live keys)

- [ ] Neon: create a **production** project (separate from dev), enable point-in-time restore. Copy the pooled connection string.
- [ ] Vercel: import this GitHub repo; Framework: Next.js; root: repo root. `main` deploys, PRs get previews.
- [ ] Migrations in the deploy: set the Vercel Build Command to `npm run db:migrate && npm run build` (migrations are idempotent). Seed only once, by hand, then edit the city and prices in Operations: `DATABASE_URL=... npm run db:seed` (the seed creates demo drivers: delete them before going public).
- [ ] Env vars in Vercel → Settings → Environment Variables (names from `.env.example`):
      `DATABASE_URL`, `APP_URL` (https://yourdomain), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
      `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_MAPBOX_TOKEN` (URL-restricted), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`.
      **Do not set `DEV_SHOW_OTP` in production.**
- [ ] Make yourself admin: after signing in once on production, run `update users set role = 'admin' where phone = '+1YOURNUMBER';` in the Neon SQL editor.
- [ ] Stripe: test mode first. Webhook endpoint `https://yourdomain/api/webhooks/stripe` with events `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`; paste its signing secret into `STRIPE_WEBHOOK_SECRET`. Add a card through Wallet, complete a ride, refund it from Operations. Then switch to live keys, repeat once with a real card and refund it.
- [ ] Twilio: a number that can send SMS in your country (US: register for A2P 10DLC, which takes days to weeks; start early).
- [ ] Resend: add and verify your sending domain.
- [ ] Mapbox: public token restricted to your domain.
- [ ] Driver background checks: a licensed vendor (e.g. Checkr) under your account; not yet integrated in code.

## Domain (after you buy it at any registrar)

| record | name | value |
| --- | --- | --- |
| A | @ | the apex IP Vercel shows in Project → Domains |
| CNAME | www | `cname.vercel-dns.com` |
| TXT | as Vercel asks | Vercel's verification value, if shown |
| SPF (TXT) | from Resend's domain page | e.g. `v=spf1 include:amazonses.com ~all` (copy Resend's exact value) |
| DKIM (TXT/CNAME) | from Resend | Resend's values |
| DMARC (TXT) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:you@yourdomain`, then `p=quarantine` once reports are clean |

- [ ] canonical host: apex (`yourdomain`), with `www` redirecting to it (Vercel domain settings)
- [ ] HTTPS valid (automatic on Vercel; check the padlock)

## Watch

- [ ] error tracking: Sentry (`@sentry/nextjs`) or Vercel's built-in logs + alerts
- [ ] uptime checks on `/` and `/api/trips/current` (expects 401 when signed out) every minute, alert to your phone
- [ ] analytics: Vercel Analytics or Plausible (no cookie banner needed)
- [ ] cron: Vercel → Settings → Cron Jobs shows `/api/cron/cleanup` hourly; `CRON_SECRET` set
- [ ] core flow on the live site: request on your phone, accept on a second phone as a driver, finish, rate, refund
- [ ] first week: matching time, unmatched requests, cancellations by side, disputes, every 1-2 star rating

## Mobile (next build milestone, not started)

Expo apps for rider and driver reusing this API: background location (driver), push notifications
(both), then `eas build` → `eas submit` to TestFlight and Play internal testing. You own the developer
accounts (9/year Apple, 5 once Google). Beta first, then review with `replica/launch/listing.json`.
