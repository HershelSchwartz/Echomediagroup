# Launch plan

Order matters: drivers first. A ride app with riders and no drivers fails on day one.

1. **Before launch**
   - Operator licence, commercial insurance and a background-check vendor in your launch city (recon: out of scope for code).
   - Driver waitlist: the `/drive` sign-up already collects applications; aim for 25+ approved drivers in one area before opening to riders.
   - Rider waitlist: a simple email form on the landing page (not built; add one, or use the sign-up itself in invite-only mode).
   - Analytics (privacy-friendly: Plausible or Vercel Analytics, no cookie banner) and error tracking (Sentry) live.
2. **Where the original's unhappy users and drivers talk** (go there as yourself, say who you are, lead with the fix):
   - Driver communities: r/uberdrivers, r/lyftdrivers, local driver Facebook and WhatsApp groups, driver advocacy groups in your city (the deactivation and pay-transparency research in `feedback.md` came from these groups' reports).
   - Riders: local subreddits and neighbourhood groups; lead with price lock and no-fault fees.
3. **Launch post** (Product Hunt or Hacker News): "We built a ride service where drivers see the cut on every trip." Lead with the open split; link the pricing table. No comparison claims about the original by name.
4. **First 10 users to talk to by hand**: 5 drivers (what would make them switch part of their hours?) and 5 riders who ride weekly in the launch area (what fee or surprise made them angry last?).
5. **Week one**: watch matching time, unmatched requests (Operations → today), cancellations by side, disputes, and every 1-2 star rating.

Store submission (when the Expo apps exist): screenshots at the sizes App Store Connect and Play Console
ask for at upload time, privacy labels / data safety form (location, phone, payment, photos), privacy and
support URLs (`/privacy`, `mailto:` support), age rating, and review notes with a demo rider and demo
driver account. Lead the screenshots with the price lock and the fare split: that's what gets past
Apple's copycat guideline 4.1.
