import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { currentTripFor, unratedTripFor } from "@/lib/trips";

export const GET = route(async () => {
  const user = await requireUser();
  const trip = await currentTripFor(user, "rider");
  return { trip, toRate: trip ? null : await unratedTripFor(user) };
});
