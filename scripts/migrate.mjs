// Applies db/migrations/*.sql in order, once each. --reset drops everything first (dev only).
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL || "postgres://ride:ride@localhost:5432/ride";
const sql = postgres(url, { onnotice: () => {} });

try {
  if (process.argv.includes("--reset")) {
    if (process.env.NODE_ENV === "production") throw new Error("refusing to reset in production");
    await sql.unsafe("drop schema public cascade; create schema public;");
    console.log("migrate: schema reset");
  }
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  for (const file of readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(`db/migrations/${file}`, "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`migrate: applied ${file}`);
  }
  console.log("migrate: up to date");
} finally {
  await sql.end();
}
