# Brand: Plainfare (working name)

Angle (from `fixes.md`, option C): open on both sides. A locked price for riders, a published split for drivers.

## Name

20 candidates: Plainfare, Evenride, Tallyride, Levelride, Openway, Glassride, Fairline, Straightfare, Clearfare,
Halfmile, Kindride, Square Deal Rides, Ledger, Neighborly, Homeward, Plainride, Truefare, Openfare, Steady, Corner.

Cut to 5 (not confusingly close to any ride app in sound or look, spellable after hearing once, says the angle):

| name | why | risk |
| --- | --- | --- |
| **Plainfare** (recommended) | "plain fare": the price is plain, nothing hidden | "fare" names are common in transit; check class 39 too |
| Evenride | even split, even deal | "Even" is a crowded prefix in fintech |
| Tallyride | every trip tallied in the open | slightly playful |
| Levelride | level with riders and drivers | close to generic |
| Openfare | says the angle directly | likely taken somewhere; check first |

Avoided on purpose: anything with "U", "-ber", "Ly-", "X", black-and-white car icons, or a pun on the original.
Also consider your own company name (Echo Media Group) as a parent brand: "Plainfare by Echo".

### Screening checks (none run yet: the build environment had no access to these services)

| check | where | Plainfare | Evenride | Tallyride | Levelride | Openfare |
| --- | --- | --- | --- | --- | --- | --- |
| US trademark (classes 9, 39, 42) | tmsearch.uspto.gov | to run | to run | to run | to run | to run |
| EU trademark | euipo.europa.eu / TMview | to run | to run | to run | to run | to run |
| Canada | ised-isde.canada.ca | to run | to run | to run | to run | to run |
| global | WIPO Global Brand Database | to run | to run | to run | to run | to run |
| domain (.com, .app) | registrar search / `whois` | to run | to run | to run | to run | to run |
| App Store and Play | search the exact name | to run | to run | to run | to run | to run |
| handles | X, Instagram, TikTok, GitHub | to run | to run | to run | to run | to run |
| the web | "name + rides" | to run | to run | to run | to run | to run |

These are screening checks, not legal clearance. Before you spend money on the name, have a trademark lawyer run a full search.
The name lives in one place (`lib/brand.ts`, plus `public/manifest.webmanifest`), so changing it later is a two-file edit.

## Palette

Role names unchanged; values in `replica/design/tokens.json`, generated into `app/tokens.css`.

| role | value | note |
| --- | --- | --- |
| accent | #3b2fc9 indigo | main buttons, route line, focus ring. Different family from the original's black/white and blue, and from the green and pink other ride apps use |
| on-accent | #ffffff | 8.62:1 on accent |
| accent-soft | #eceafb | selected ride option |
| text / muted | #111318 / #545b66 | |
| pickup / drop-off | #17703f / #111318 | green dot, black square: functional, kept |

Contrast: 15 pairs, 0 AA failures (`contrast.py`). The original's colours (#000000, #276ef1, #06c167) are in `brand.json` so the sweep catches any that sneak back.

## Logo brief

- Idea: a plain "P" drawn as a single continuous route line that ends in a drop-off square. The price is the path; nothing extra.
- Mark: symbol + wordmark ("Plainfare" in a geometric sans, medium weight, sentence case).
- Must work at 16 px (favicon: the P alone) and as a 1024 px app icon (white P on indigo, no transparency for iOS).
- Deliverables: SVG mark and lockup, 1024x1024 app icon, favicon set (16, 32, 180, 512), social image 1200x630.
- Must not resemble the original's mark: no black square tile with white letters, no circle-in-square, no car silhouette. Put the original's logo next to the drafts and check.
- Placeholder in use now: `public/icon.svg` (a rough P on indigo). Replace with the final mark.

## Voice

Three words: **plain** (not dull), **fair** (not preachy), **calm** (not cold).

| do | don't |
| --- | --- |
| "You'll pay $11.50." | "Fares from $11.50*" |
| "Your driver is 4 min away." | "Hang tight! Your ride is on its way!!" |
| "No fee. Your driver didn't head your way." | "Fee waived as a courtesy." |
| "We keep $1.80 of this fare." | "Service fee applies." |
| "A person will read this." | "Your ticket has been escalated." |

### The 10 most-seen strings (all written fresh for this app)

| where | string |
| --- | --- |
| sign in | "What's your mobile number?" / "We'll text you a code to sign in. No password needed." |
| home | "Hi Alex, where to?" |
| choose | "Request Standard" + "Price lock: you pay the price above. It only changes if you change the destination or keep your driver waiting past the free minutes." |
| matching | "Finding you a driver" / "This usually takes under a minute." |
| arriving | "Your driver is 4 min away" / "Meet them at the green pickup dot." |
| arrived | "Your driver is here" |
| cancel | "Cancel this ride?" / "You won't be charged." |
| no cars | "No cars are free right now" / "You weren't charged." |
| rate | "How was your ride with Dana?" |
| driver offer | "you earn, before tips" / "Rider pays $11.50 · we keep $4.30" |

## Sweep

`python3 .claude/skills/replica-brand/sweep.py . --config replica/brand.json` → **Clean** (exit 0), 2026-10-26.
By eye: page titles use `brand.name`; favicon and manifest updated; receipt and SMS templates use `brand.name`;
no OG image yet (add the 1200x630 social image from the logo brief).
