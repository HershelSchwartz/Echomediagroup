import { z } from "zod";
import { route } from "@/lib/http";
import { logout } from "@/lib/auth";

export const POST = route(async (req) => {
  const { everywhere } = z.object({ everywhere: z.boolean().optional() }).parse(await req.json().catch(() => ({})));
  await logout(!!everywhere);
  return { ok: true };
});
