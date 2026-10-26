import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { money } from "@/lib/money";
import { PageShell } from "@/components/shared/PageShell";
import { ListRow } from "@/components/ui/ListRow";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  completed: "", cancelled_by_rider: "Cancelled", cancelled_by_driver: "Cancelled by driver", no_drivers: "No cars available",
  matching: "Finding a driver", accepted: "Driver on the way", arrived: "Driver arrived", in_progress: "On trip",
};

export default async function Activity() {
  const user = (await getUser())!;
  const [city] = await sql`select timezone from cities limit 1`;
  const trips = await sql`select t.id, t.status, t.dropoff_address, t.requested_at, t.final_fare_cents, t.cancel_fee_cents, t.tip_cents, t.currency, p.name as product
    from trips t join products p on p.id = t.product_id where t.rider_id = ${user.id} order by t.requested_at desc limit 50`;
  return (
    <PageShell title="Activity" back="/ride">
      {trips.length === 0 ? (
        <p className="py-16 text-center text-text-muted">No rides yet. Your trips and receipts will show up here.</p>
      ) : (
        <ul>
          {trips.map((t) => {
            const when = new Date(t.requested_at).toLocaleString("en-US", { timeZone: city?.timezone, dateStyle: "medium", timeStyle: "short" });
            const amount = t.status === "completed" ? money(t.final_fare_cents + t.tip_cents, t.currency) : t.cancel_fee_cents ? money(t.cancel_fee_cents, t.currency) : money(0, t.currency);
            return (
              <li key={t.id}>
                <ListRow href={`/ride/activity/${t.id}`} title={t.dropoff_address} subtitle={`${when} · ${t.product}${LABEL[t.status] ? ` · ${LABEL[t.status]}` : ""}`}
                  trailing={<span className="font-medium">{amount}</span>} />
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
