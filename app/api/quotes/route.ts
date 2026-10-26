import { z } from "zod";
import { route, body, zPlace } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { quote } from "@/lib/trips";

export const POST = route(async (req) => {
  await requireUser();
  const i = await body(req, z.object({ pickup: zPlace, dropoff: zPlace, stops: z.array(zPlace).max(2).default([]) }));
  return quote(i.pickup, i.dropoff, i.stops);
});
