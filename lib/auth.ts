import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import { fail } from "./http";
import { sendSms, smsConfigured } from "./notify";
import { brand } from "./brand";

export type User = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: "rider" | "driver" | "admin";
  rating: number | null;
};

const COOKIE = "sid";
const SESSION_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_TRIES = 5;
const OTP_PER_HOUR = 5;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Accepts +E.164, or a 10-digit US number. Returns +E.164 or null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return null;
}

export function devOtpAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_SHOW_OTP === "1" && !smsConfigured();
}

export async function startOtp(phone: string): Promise<{ devCode?: string }> {
  const [{ n }] = await sql`select count(*)::int as n from otp_codes where phone = ${phone} and created_at > now() - interval '1 hour'`;
  if (n >= OTP_PER_HOUR) throw fail(429, "Too many codes requested for this number. Try again in an hour.", "rate_limited");
  if (!smsConfigured() && !devOtpAllowed()) throw fail(503, "Text messages are not set up yet.", "sms_unconfigured");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await sql`insert into otp_codes (phone, code_hash, expires_at)
    values (${phone}, ${sha(phone + ":" + code)}, now() + ${OTP_MINUTES + " minutes"}::interval)`;
  await sendSms(phone, `${code} is your ${brand.name} code. It expires in ${OTP_MINUTES} minutes. Don't share it.`);
  return devOtpAllowed() ? { devCode: code } : {};
}

export async function verifyOtp(phone: string, code: string): Promise<{ user: User; isNew: boolean }> {
  const [otp] = await sql`select id, code_hash, attempts from otp_codes
    where phone = ${phone} and used_at is null and expires_at > now() order by created_at desc limit 1`;
  if (!otp) throw fail(400, "That code has expired. Send a new one.", "otp_expired");
  if (otp.attempts >= OTP_TRIES) throw fail(429, "Too many wrong tries. Send a new code.", "otp_locked");
  await sql`update otp_codes set attempts = attempts + 1 where id = ${otp.id}`;
  const a = Buffer.from(sha(phone + ":" + code));
  const b = Buffer.from(otp.code_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail(400, "That code didn't match. Check it and try again.", "otp_wrong");
  await sql`update otp_codes set used_at = now() where id = ${otp.id}`;

  const [existing] = await sql`select id from users where phone = ${phone} and deleted_at is null`;
  let userId: string = existing?.id;
  if (!userId) [{ id: userId }] = await sql`insert into users (phone) values (${phone}) returning id`;

  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${sha(token)}, now() + ${SESSION_DAYS + " days"}::interval)`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  const user = (await userById(userId))!;
  return { user, isNew: !existing };
}

export async function userById(id: string): Promise<User | null> {
  const [u] = await sql`select id, phone, name, email, role,
      case when rating_count > 0 then round(rating_sum::numeric / rating_count, 2)::float end as rating
    from users where id = ${id} and deleted_at is null`;
  return (u as unknown as User) ?? null;
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [s] = await sql`select user_id from sessions where token_hash = ${sha(token)} and expires_at > now()`;
  return s ? userById(s.user_id) : null;
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) throw fail(401, "Please sign in.", "unauthenticated");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") throw fail(403, "You don't have access to this.", "forbidden");
  return u;
}

export async function logout(everywhere = false) {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    if (everywhere) await sql`delete from sessions where user_id = (select user_id from sessions where token_hash = ${sha(token)})`;
    else await sql`delete from sessions where token_hash = ${sha(token)}`;
  }
  jar.delete(COOKIE);
}

export const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] || "Rider";
