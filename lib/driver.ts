import { sql } from "./db";
import { fail } from "./http";
import { requireUser, type User } from "./auth";

export async function requireDriver(opts: { approved?: boolean } = {}): Promise<{ user: User; profile: Record<string, any> }> {
  const user = await requireUser();
  const [profile] = await sql`select * from driver_profiles where user_id = ${user.id}`;
  if (!profile) throw fail(403, "Sign up to drive first.", "not_driver");
  if (opts.approved && profile.status !== "approved") {
    throw fail(403, profile.status === "pending" ? "Your documents are still being reviewed." : "Your driver account isn't active.", "not_approved");
  }
  return { user, profile };
}
