import { z } from "zod";
import { route, body, fail, rateLimit, clientIp } from "@/lib/http";
import { normalizePhone, verifyOtp } from "@/lib/auth";

export const POST = route(async (req) => {
  const { phone, code } = await body(req, z.object({ phone: z.string(), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }));
  const p = normalizePhone(phone);
  if (!p) throw fail(400, "Enter a valid mobile number.", "bad_phone");
  rateLimit(`verify:${clientIp(req)}`, process.env.NODE_ENV === "production" ? 30 : 500, 3600_000);
  const { user, isNew } = await verifyOtp(p, code);
  return { user, needsProfile: isNew || !user.name };
});
