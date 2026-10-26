import { sql } from "./db";
import { brand } from "./brand";

const twilio = () =>
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
    ? { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM_NUMBER }
    : null;

export const smsConfigured = () => !!twilio();

/** Records the SMS in the outbox and sends it through Twilio when configured. */
export async function sendSms(to: string, text: string): Promise<boolean> {
  const [row] = await sql`insert into outbox (channel, to_addr, body) values ('sms', ${to}, ${text}) returning id`;
  const t = twilio();
  if (!t) {
    await sql`update outbox set status = 'logged' where id = ${row.id}`;
    return false;
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${t.sid}:${t.token}`).toString("base64") },
      body: new URLSearchParams({ To: to, From: t.from, Body: text }),
    });
    if (!res.ok) throw new Error(`twilio ${res.status}`);
    await sql`update outbox set status = 'sent' where id = ${row.id}`;
    return true;
  } catch (e) {
    await sql`update outbox set status = 'failed', error = ${String(e)} where id = ${row.id}`;
    return false;
  }
}

/** Records the email in the outbox and sends it through Resend when configured. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const [row] = await sql`insert into outbox (channel, to_addr, subject, body) values ('email', ${to}, ${subject}, ${text}) returning id`;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    await sql`update outbox set status = 'logged' where id = ${row.id}`;
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${brand.name} <${from}>`, to: [to], subject, text }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
    await sql`update outbox set status = 'sent' where id = ${row.id}`;
    return true;
  } catch (e) {
    await sql`update outbox set status = 'failed', error = ${String(e)} where id = ${row.id}`;
    return false;
  }
}
