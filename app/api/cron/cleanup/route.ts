import { sql } from "@/lib/db";

/** Hourly (vercel.json). Protected by CRON_SECRET, sent by Vercel Cron as a bearer token. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const r = await sql.begin(async (tx) => {
    const sessions = await tx`delete from sessions where expires_at < now()`;
    const otps = await tx`delete from otp_codes where expires_at < now() - interval '1 day'`;
    const links = await tx`delete from share_links where expires_at < now()`;
    const offers = await tx`update dispatch_offers set response = 'expired', responded_at = now() where response = 'pending' and expires_at <= now()`;
    const stale = await tx`update trips set status = 'no_drivers', updated_at = now() where status = 'matching' and requested_at < now() - interval '3 minutes'`;
    const crumbs = await tx`delete from trip_locations where at < now() - interval '90 days'`;
    const offline = await tx`update driver_profiles set online = false where online and last_seen_at < now() - interval '10 minutes'`;
    return { sessions: sessions.count, otps: otps.count, links: links.count, offers: offers.count, stale: stale.count, crumbs: crumbs.count, offline: offline.count };
  });
  return Response.json(r);
}
