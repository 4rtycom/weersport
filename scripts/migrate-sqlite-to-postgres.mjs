/**
 * Copy SQLite rows into Postgres (DATABASE_URL). Read-only on source.
 * Usage: DATABASE_URL=postgres://... WEERSPORT_DB=./data/weersport.sqlite node scripts/migrate-sqlite-to-postgres.mjs
 */
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const sqlitePath = process.env.WEERSPORT_DB ?? path.join(process.cwd(), "data", "weersport.sqlite");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!existsSync(sqlitePath)) {
  console.error(`SQLite file missing: ${sqlitePath}`);
  process.exit(1);
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: process.env.WEERSPORT_DB_SSL === "0" ? false : { rejectUnauthorized: false } });

const migration = readFileSync(path.join(process.cwd(), "migrations/001_phase1_core.sql"), "utf8");
await pool.query(migration);

const tables = [
  "users",
  "sessions",
  "tokens",
  "login_attempts",
  "planned_moments",
  "saved_searches",
  "favorite_sports",
  "user_preferences",
  "analysis_ledger",
  "analysis_cache",
  "billing_customers",
  "billing_checkouts",
  "billing_subscriptions",
  "billing_invoices",
  "billing_webhook_events",
];

for (const table of tables) {
  let rows = [];
  try {
    rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  } catch {
    console.log(`skip missing table ${table}`);
    continue;
  }
  if (!rows.length) {
    console.log(`${table}: 0 rows`);
    continue;
  }
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
  let inserted = 0;
  for (const row of rows) {
    await pool.query(
      sql,
      columns.map((c) => row[c]),
    );
    inserted += 1;
  }
  console.log(`${table}: migrated ${inserted} rows`);
}

await pool.end();
console.log("migration complete — keep SQLite read-only until cutover reconciliation is signed off");
