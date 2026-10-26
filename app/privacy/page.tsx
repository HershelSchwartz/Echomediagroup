import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/LegalPage";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="October 26, 2026">
      <p>This explains what {brand.name} collects, why, who we share it with, and how to delete it.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account: mobile number, name, optional email and photo.</li>
        <li>Trips: pickup, stops and drop-off; times; fare, fees, tips; ratings and messages with your driver or rider.</li>
        <li>Location: riders' location while the app is open, to set pickup. Drivers' location while online or on a trip, to match and show the trip.</li>
        <li>Payments: card details are held by Stripe; we store only the card brand, last four digits and expiry.</li>
        <li>Drivers: licence number and expiry, vehicle details and the documents you upload.</li>
        <li>Support: what you tell us when you ask for help.</li>
      </ul>
      <h2>Why</h2>
      <p>To provide rides, take payment, keep riders and drivers safe, handle disputes and refunds, and meet legal duties (tax, regulator requests).</p>
      <h2>Who we share it with</h2>
      <ul>
        <li>The other side of your trip: your driver sees your first name, rating and pickup; you see your driver's first name, photo, rating, car and plate. Phone numbers are never shared.</li>
        <li>People you send a trip link to: status, the driver's first name and car, and positions. Not your name or number. Links expire after 12 hours.</li>
        <li>Service providers who process data for us: Stripe (payments), Twilio (text messages), Resend (email), Mapbox (maps, address search), Vercel (hosting), Neon (database). [Update this list to match the providers you actually use, and add any background-check provider for drivers.]</li>
        <li>Authorities, when the law requires it.</li>
      </ul>
      <p>We don't sell personal data.</p>
      <h2>How long we keep it</h2>
      <p>Location breadcrumbs from trips: 90 days. Trip and payment records: as long as tax law requires. Everything else: until you delete your account.</p>
      <h2>Your choices</h2>
      <p>Delete your account any time in Account → Delete account. We remove your profile, photo, saved places, payment methods and messages; trip records are kept without your name for accounting. To get a copy of your data, email {brand.supportEmail}.</p>
      <h2>Cookies</h2>
      <p>One essential cookie keeps you signed in. We don't use advertising or tracking cookies.</p>
      <h2>Contact</h2>
      <p>{brand.supportEmail}</p>
    </LegalPage>
  );
}
