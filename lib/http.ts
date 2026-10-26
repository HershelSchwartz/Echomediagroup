import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const fail = (status: number, message: string, code?: string, extra?: Record<string, unknown>) =>
  new HttpError(status, message, code, extra);

export type Ctx<P = Record<string, string>> = { params: Promise<P> };

/** Wraps a route handler: turns thrown HttpErrors and validation errors into JSON responses. */
export function route<P = Record<string, string>>(fn: (req: Request, ctx: Ctx<P>) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, code: e.code, ...e.extra }, { status: e.status });
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return NextResponse.json({ error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input", code: "invalid" }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "server" }, { status: 500 });
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw fail(400, "Expected a JSON body", "invalid");
  }
  return schema.parse(data);
}

export const zLatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const zPlace = zLatLng.extend({ address: z.string().trim().min(1).max(200) });
export const zUuid = z.string().uuid();

/** Postgres unique violation, optionally on a named constraint/index. */
export function isUnique(e: unknown, name?: string): boolean {
  const err = e as { code?: string; constraint_name?: string };
  return err?.code === "23505" && (!name || err.constraint_name === name);
}

/** Small in-memory limiter for per-IP limits. Per-phone limits live in the database. */
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw fail(429, "Too many attempts. Please wait a bit and try again.", "rate_limited");
  list.push(now);
  hits.set(key, list);
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
