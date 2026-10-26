"use client";
import Link from "next/link";
import { fmtMoney } from "@/lib/client";
import type { Trip } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

/** Shown once when a ride ends without completing: no cars, or the driver marked a no-show. */
export function OutcomeSheet({ trip, onDone, onRetry }: { trip: Trip; onDone: () => void; onRetry: () => void }) {
  if (trip.status === "no_drivers") {
    return (
      <Sheet label="No cars available">
        <h1 className="text-xl font-bold">No cars are free right now</h1>
        <p className="mb-4 text-sm text-text-muted">You weren't charged. Try again in a minute, or pick a different ride option.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onDone}>Close</Button>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet label="Ride cancelled">
      <h1 className="text-xl font-bold">Your ride was cancelled</h1>
      <p className="mb-4 text-sm text-text-muted">
        {trip.cancelReason === "rider_no_show"
          ? `Your driver waited at the pickup and couldn't find you. A ${fmtMoney(trip.cancelFeeCents, trip.currency)} fee applies.`
          : "Sorry about that. You weren't charged."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/ride/activity/${trip.id}`} className="inline-flex h-12 items-center justify-center rounded-md bg-surface font-semibold">See details</Link>
        <Button onClick={onDone}>OK</Button>
      </div>
    </Sheet>
  );
}
