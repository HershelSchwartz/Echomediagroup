# Pricing

Read 2026-10-26. The original's rider prices vary by city and time and are not published as a rate card;
its public help pages document the fee rules (wait time, cancellation) that this app mirrors and loosens.

| | original (public sources) | this app |
| --- | --- | --- |
| rider fare | upfront price, set per trip by its pricing system | upfront price from a published rate card: base + per km + per minute, minimum, booking fee |
| busy-time pricing | dynamic, uncapped in most markets | admin multiplier x automatic factor, capped at 2.0, shown before booking |
| wait time | per minute after 2 min (economy) / 5 min (premium) [help.uber.com](https://help.uber.com/h/22b6db22-0f86-4765-ac72-da549a2302d7) | same structure: 2 / 5 min free, then per minute |
| cancellation | fee after 2 / 5 min from accept [help.uber.com](https://help.uber.com/h/6bec690f-ee35-40ba-96ee-c38a8ae796e0) | same windows, plus waived when the driver is >5 min late or made no progress toward the pickup |
| driver share | weekly average take rate shown since Jan 2025; per-trip cut not shown; estimates range from ~21% (company, after costs) to >50% (independent analysis) [Yahoo Finance](https://finance.yahoo.com/economy/policy/articles/uber-driver-pay-falling-company-103000718.html) | fixed and published: driver keeps 80% of fare after booking fee + 100% of tips and wait time; shown on every offer |

Seed rate card (edit in Operations → Pricing; values are placeholders to calibrate against local taxi and
ride-app prices before launch):

| ride | base | per km | per min | minimum | booking fee | 5 km / 15 min example |
| --- | --- | --- | --- | --- | --- | --- |
| Standard | $2.50 | $1.10 | $0.32 | $9.00 | $2.50 | $15.80 |
| XL | $4.00 | $1.75 | $0.45 | $14.00 | $2.50 | $22.25 |
| Premium | $8.00 | $2.60 | $0.60 | $25.00 | $0.00 | $30.00 |

Billing complaints fixed in the product: price lock, no-fault fee waivers, instant first-dispute refund,
one-tap removal of payment methods, receipts by email. There's no subscription, so nothing to cancel.

Stripe: no Products or Prices are needed (fares are one-off PaymentIntents). Create in your Stripe dashboard:
the account, a webhook endpoint for `checkout.session.completed`, `payment_intent.succeeded`,
`payment_intent.payment_failed`, and later Stripe Connect (Express) for driver payouts.
