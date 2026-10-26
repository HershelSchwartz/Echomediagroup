import postgres from "postgres";

const url = process.env.DATABASE_URL || "postgres://ride:ride@localhost:5432/ride";

// One pool per server process; reused across hot reloads in dev.
const g = globalThis as unknown as { __sql?: postgres.Sql };
export const sql =
  g.__sql ??
  postgres(url, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    onnotice: () => {},
  });
if (process.env.NODE_ENV !== "production") g.__sql = sql;

export type Tx = postgres.TransactionSql;
