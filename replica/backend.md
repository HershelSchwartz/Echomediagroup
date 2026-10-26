# Backend

| part | how | status |
| --- | --- | --- |
| auth | phone + 6-digit SMS code (hashed, 10 min, 5 tries), 30-day http-only cookie sessions, sign out everywhere, account deletion | done |
| database | Postgres, SQL migrations in db/migrations run by `npm run db:migrate`, seed by `npm run db:seed` | done |
| access rules | data-layer checks: requireUser/requireAdmin/requireDriver on every route; trips only through loadTripFor (rider, driver or admin) | done, tested with a second user (404) |
| payments | Stripe Checkout (setup mode) saves cards, off-session PaymentIntents for fare, tip, fees; idempotency keys; refunds; webhook with signature check and event-id dedupe | written; dev adapter tested; needs your test keys to verify |
| email | Resend, from your verified domain, through the outbox table | written; logged-only until keys are set |
| SMS | Twilio Messages for codes and guest-rider updates, through the outbox | written; logged-only until keys are set |
| maps | Mapbox Directions, Geocoding (forward + reverse) and tiles when NEXT_PUBLIC_MAPBOX_TOKEN is set; offline fallback otherwise | written; fallback tested |
| jobs | /api/cron/cleanup hourly via vercel.json, CRON_SECRET bearer | written |
| files | driver documents and photos in Postgres (5 MB / 2 MB limits, type checked, served with CSP sandbox) | done |

Accounts you create (Claude never signs up for services or handles live keys):
Neon (Postgres), Vercel, Stripe (test mode first), Twilio (a number, or Verify), Resend (verify your domain),
Mapbox (public token, URL-restricted to your domain). Put keys in `.env.local` locally and in Vercel's
environment settings for production. Names are in `.env.example`.

## Security checklist

- [x] secrets only in env vars, `.env*` git-ignored, only the public Mapbox token is in the client bundle
- [x] input validated on the server (zod) on every route
- [x] authorisation on every read and write; second-user test returns 404, rider-on-driver-action 403
- [x] rate limits: codes 5/hour/phone + per-IP; verify 5 tries/code + per-IP
- [x] Stripe webhook verifies the signature and dedupes event ids
- [x] uploads: size and type limits; served with `Content-Security-Policy: sandbox`, never inline-executed
- [x] no personal data in URLs; share links are random tokens with no rider name or phone behind them; OTP codes masked in the admin outbox
- [x] `npm audit`: 0 vulnerabilities at install
- [ ] privacy policy lists every processor: written in replica-launch (`/privacy`), needs your legal review
- [ ] host backups: turn on Neon point-in-time restore (on by default on paid plans)
