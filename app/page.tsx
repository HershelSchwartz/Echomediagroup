import type { Metadata } from "next";
import Link from "next/link";
import { Check, Lock, Receipt, Scale, ShieldCheck, Smartphone } from "lucide-react";
import { sql } from "@/lib/db";
import { brand } from "@/lib/brand";
import { fare, PLATFORM_TAKE, type PriceRule } from "@/lib/pricing";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: { absolute: `${brand.name}: rides with a locked price and an open split` }, description: brand.tagline };
export const dynamic = "force-dynamic";

const SAMPLE_M = 5000, SAMPLE_S = 15 * 60;

export default async function Landing() {
  const products = await sql`select p.*, c.name as city, c.currency from products p join cities c on c.id = p.city_id where p.active order by p.sort`.catch(() => []);
  const city = products[0]?.city as string | undefined;
  return (
    <div className="bg-bg text-text">
      <header className="mx-auto flex max-w-[var(--layout-admin-max)] items-center justify-between px-4 py-4">
        <span className="text-lg font-bold">{brand.name}</span>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <a href="#pricing" className="rounded-md px-3 py-2 hover:bg-surface">Pricing</a>
          <Link href="/drive" className="rounded-md px-3 py-2 hover:bg-surface">Drive</Link>
          <Link href="/login" className="rounded-md px-3 py-2 hover:bg-surface">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-[var(--layout-admin-max)] px-4 pb-16 pt-10 sm:pt-20">
          <h1 className="max-w-3xl text-[2.5rem] font-bold leading-[1.1] sm:text-[3.5rem]">The price you see is the price you pay. The split is on every receipt.</h1>
          <p className="mt-4 max-w-2xl text-lg text-text-muted">
            {brand.name} is a local ride service{city ? ` in ${city}` : ""} that locks your fare before you book and shows drivers exactly what we keep.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ride" className="inline-flex h-14 items-center rounded-md bg-accent px-6 text-lg font-semibold text-on-accent">Get a ride</Link>
            <Link href="/drive" className="inline-flex h-14 items-center rounded-md bg-surface px-6 text-lg font-semibold">Drive with us</Link>
          </div>
        </section>

        <section aria-labelledby="problem" className="bg-surface">
          <div className="mx-auto grid max-w-[var(--layout-admin-max)] gap-8 px-4 py-16 sm:grid-cols-2">
            <h2 id="problem" className="text-xl font-bold sm:col-span-2">Two things ride apps get wrong</h2>
            <div>
              <h3 className="mb-1 font-semibold">Riders get fees they didn't agree to</h3>
              <p className="text-text-muted">A price that moves after you book. A cancellation fee when it was the driver who didn't show. We think both are on us, not you.</p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold">Drivers can't see what the app keeps</h3>
              <p className="text-text-muted">If you're doing the driving, you should know what the rider paid and what the platform took on every single trip. Not a weekly average.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-[var(--layout-admin-max)] px-4 py-16">
          <h2 id="how" className="mb-6 text-xl font-bold">How it works</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[
              ["Say where you're going", "Pick a place or a saved spot. You'll see every ride option with its full price."],
              ["Lock the price and request", "The nearest driver gets your request. Watch them come to you on the map."],
              ["Ride, then rate", "Your card is charged the locked price. Tip if you like: all of it goes to your driver."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-lg bg-surface p-5">
                <span className="mb-2 grid h-8 w-8 place-items-center rounded-pill bg-accent font-bold text-on-accent" aria-hidden>{i + 1}</span>
                <h3 className="mb-1 font-semibold">{t}</h3>
                <p className="text-sm text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features" className="bg-surface">
          <div className="mx-auto max-w-[var(--layout-admin-max)] px-4 py-16">
            <h2 id="features" className="mb-6 text-xl font-bold">What's different</h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [Lock, "Price lock", "The upfront price is your charge. It only changes if you change the destination, or keep your driver waiting past the free minutes."],
                [ShieldCheck, "No fee for our mistakes", "If your driver cancels, is running late, or never headed your way, you don't pay a cancellation fee."],
                [Scale, "Open split for drivers", `Every offer shows what the rider pays and what we keep. Drivers keep ${Math.round((1 - PLATFORM_TAKE) * 100)}% of the fare and all tips and wait time.`],
                [Receipt, "A person answers", "Disputed a fee for the first time? It's refunded on the spot. Anything else goes to a real person."],
                [Check, "Fair reviews for drivers", "We never pause a driver without a written reason they can read, and a one-tap request for a human review."],
                [Smartphone, "Works in your browser", "No download needed to get started. Share your live trip with anyone, without sharing your name or number."],
              ].map(([Icon, t, d]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={t as string}>
                    <I className="mb-2 h-6 w-6 text-accent" aria-hidden />
                    <h3 className="mb-1 font-semibold">{t as string}</h3>
                    <p className="text-sm text-text-muted">{d as string}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="pricing-h" id="pricing" className="mx-auto max-w-[var(--layout-admin-max)] px-4 py-16">
          <h2 className="mb-2 text-xl font-bold" id="pricing-h">Pricing</h2>
          <p className="mb-6 text-text-muted">Published, not hidden. Example: a 5 km, 15 minute ride.</p>
          {products.length === 0 ? <p className="text-text-muted">Prices appear here once the service area is set up.</p> : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby="pricing-h">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-4">Ride</th><th scope="col" className="py-2 pr-4">Seats</th><th scope="col" className="py-2 pr-4">Base</th>
                    <th scope="col" className="py-2 pr-4">Per km</th><th scope="col" className="py-2 pr-4">Per min</th><th scope="col" className="py-2 pr-4">Booking fee</th>
                    <th scope="col" className="py-2 pr-4">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-border">
                      <th scope="row" className="py-3 pr-4 font-semibold">{p.name}</th><td className="pr-4">{p.seats}</td>
                      <td className="pr-4">{money(p.base_cents, p.currency)}</td><td className="pr-4">{money(p.per_km_cents, p.currency)}</td>
                      <td className="pr-4">{money(p.per_min_cents, p.currency)}</td><td className="pr-4">{money(p.booking_fee_cents, p.currency)}</td>
                      <td className="pr-4 font-semibold">{money(fare(p as unknown as PriceRule, SAMPLE_M, SAMPLE_S), p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-sm text-text-muted">
            At busy times prices can rise, never more than 2x, and you'll see it before you book. Cancelling is free for the first few minutes after a driver accepts.
            Drivers keep {Math.round((1 - PLATFORM_TAKE) * 100)}% of the fare (after the booking fee) plus all tips and wait time.
          </p>
        </section>

        <section aria-labelledby="faq" className="bg-surface">
          <div className="mx-auto max-w-[var(--layout-admin-max)] px-4 py-16">
            <h2 id="faq" className="mb-6 text-xl font-bold">Questions</h2>
            <dl className="grid gap-6 sm:grid-cols-2">
              {[
                ["Where do you operate?", city ? `${city} to start. We'll add areas as we sign up drivers there.` : "We're launching city by city."],
                ["Do I need an app?", "No. It works in your phone's browser; add it to your home screen for one-tap access. Native apps are coming."],
                ["What if my driver cancels?", "We find you another driver right away and you're never charged a cancellation fee for it."],
                ["How do I drive?", "Tap Drive, add your licence and car, upload four documents, and we'll review them. A background check is required before your first trip."],
                ["How do I pay?", "Card or cash. Your card is charged the locked price after the ride."],
                ["Can I ride for someone else?", "Yes. Book for a friend; we'll text them the driver's details."],
              ].map(([q, a]) => (
                <div key={q}><dt className="mb-1 font-semibold">{q}</dt><dd className="text-sm text-text-muted">{a}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-[var(--layout-admin-max)] px-4 py-16 text-center">
          <h2 className="mb-4 text-xl font-bold">Ready when you are.</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/ride" className="inline-flex h-14 items-center rounded-md bg-accent px-6 text-lg font-semibold text-on-accent">Get a ride</Link>
            <Link href="/drive" className="inline-flex h-14 items-center rounded-md bg-surface px-6 text-lg font-semibold">Drive with us</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[var(--layout-admin-max)] flex-wrap justify-between gap-2 px-4 py-6 text-sm text-text-muted">
          <span>© {new Date().getFullYear()} {brand.name}</span>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <a href={`mailto:${brand.supportEmail}`} className="hover:underline">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
