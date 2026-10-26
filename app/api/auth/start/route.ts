import { z } from "zod";
import { route, body, fail, rateLimit, clientIp } from "@/lib/http";
import { normalizePhone, startOtp } from "@/lib/auth";

export const POST = route(async (req) => {
  const { phone } = await body(req, z.object({ phone: z.string().min(7).max(20) }));
  const p = normalizePhone(phone);
  if (!p) throw fail(400, "Enter a mobile number with country code, like +1 555 123 4567.", "bad_phone");
  rateLimit(`otp:${clientIp(req)}`, 20, 3600_000);
  const out = await startOtp(p);
  return { ok: true, phone: p, ...out };
});
