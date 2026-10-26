import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { defaultCity } from "@/lib/trips";
import { DriverApply } from "@/components/driver/DriverApply";
import { DriverDocuments } from "@/components/driver/DriverDocuments";
import { DriverApp } from "@/components/driver/DriverApp";
import { PageShell } from "@/components/shared/PageShell";
import { Banner } from "@/components/ui/Banner";

export const metadata: Metadata = { title: "Drive" };
export const dynamic = "force-dynamic";

export default async function DrivePage() {
  const user = (await getUser())!;
  const [profile] = await sql`select status, review_note from driver_profiles where user_id = ${user.id}`;
  const city = await defaultCity();
  if (!profile) return <PageShell title="Drive with us" back="/ride"><DriverApply name={user.name ?? ""} /></PageShell>;
  if (profile.status !== "approved") {
    return (
      <PageShell title="Your application" back="/ride">
        {profile.status === "pending" && <Banner className="mb-4">We're reviewing your details. Upload all four documents to speed it up. We'll text you when you're approved.</Banner>}
        {profile.status === "rejected" && <Banner variant="danger" className="mb-4">We couldn't approve your application.{profile.review_note ? ` ${profile.review_note}` : ""} Upload new documents and we'll take another look.</Banner>}
        {profile.status === "suspended" && <Banner variant="danger" className="mb-4">Your driver account is paused.{profile.review_note ? ` ${profile.review_note}` : ""} Contact support for help.</Banner>}
        <DriverDocuments />
      </PageShell>
    );
  }
  return <DriverApp city={{ name: city.name, center: { lat: city.center_lat, lng: city.center_lng } }} simulate={process.env.NODE_ENV !== "production"} />;
}
