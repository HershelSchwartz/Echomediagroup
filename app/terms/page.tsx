import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/LegalPage";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="October 26, 2026">
      <p>These terms cover your use of {brand.name}. [Name the legal entity that operates the service and its licence to arrange rides for hire in each city.]</p>
      <h2>Rides</h2>
      <p>The price shown before you request is the price you pay, except: waiting time after the free minutes at pickup, a destination you change during the trip, and tips you choose to add. Prices may be higher at busy times, never more than 2x, and you'll see that before you book.</p>
      <h2>Cancelling</h2>
      <p>Cancelling is free until a few minutes after a driver accepts (the exact window is shown in the app). After that a cancellation fee may apply, except when the driver is more than 5 minutes late, hasn't headed toward you, or cancels themselves. If a driver waits at the pickup past the no-show time and you don't arrive, a cancellation fee applies.</p>
      <h2>Payment</h2>
      <p>You authorise us to charge your chosen payment method for fares, fees and tips. If a charge fails, you'll need to pay it before your next ride.</p>
      <h2>Conduct</h2>
      <p>Be respectful and safe. We may pause accounts for safety or fraud. Drivers always receive the reason in writing and can ask for a human review.</p>
      <h2>Drivers</h2>
      <p>Drivers must hold a valid licence, insurance that covers rides for hire where required, and pass a background check. Drivers keep 80% of each fare after the booking fee, plus all tips and wait time. [Add your driver agreement: contractor status, payouts schedule, insurance terms.]</p>
      <h2>Liability</h2>
      <p>[Your lawyer should write this section for your jurisdiction.]</p>
      <h2>Contact</h2>
      <p>{brand.supportEmail}</p>
    </LegalPage>
  );
}
