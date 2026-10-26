import { sql } from "@/lib/db";
import { route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async () => {
  await requireAdmin();
  // One-time codes are masked even for admins.
  return { messages: await sql`select id, channel, to_addr, subject,
      regexp_replace(body, '^\\d{6} is your', '•••••• is your') as body, status, error, created_at
    from outbox order by created_at desc limit 100` };
});
