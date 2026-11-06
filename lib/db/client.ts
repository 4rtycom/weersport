import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

export type StoreMode = "postgres" | "sqlite";

type SqliteDb = DatabaseSync;

const globalStore = globalThis as unknown as {
  weersportPgPool?: pg.Pool;
  weersportSqlite?: SqliteDb;
  weersportSchemaReady?: boolean;
};

const pgTx = new AsyncLocalStorage<pg.PoolClient>();

export function storeMode(): StoreMode {
  return process.env.DATABASE_URL?.trim() ? "postgres" : "sqlite";
}

export function isDurableStore() {
  return storeMode() === "postgres";
}

function sqlitePath() {
  return process.env.WEERSPORT_DB ?? path.join(process.cwd(), "data", "weersport.sqlite");
}

function sqliteDb() {
  if (!globalStore.weersportSqlite) {
    const file = sqlitePath();
    mkdirSync(path.dirname(file), { recursive: true });
    globalStore.weersportSqlite = new DatabaseSync(file);
    globalStore.weersportSqlite.exec("PRAGMA journal_mode = WAL;");
  }
  return globalStore.weersportSqlite;
}

function pgPool() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL ontbreekt");
  if (!globalStore.weersportPgPool) {
    globalStore.weersportPgPool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.WEERSPORT_DB_POOL_MAX ?? 5),
      ssl: process.env.WEERSPORT_DB_SSL === "0" ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalStore.weersportPgPool;
}

export function toSqliteSql(text: string) {
  return text.replace(/\$(\d+)/g, "?");
}

async function pgQuery(text: string, params: unknown[] = []) {
  const tx = pgTx.getStore();
  if (tx) return tx.query(text, params);
  return pgPool().query(text, params);
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  if (storeMode() === "postgres") {
    const result = await pgQuery(text, params);
    return result.rows as T[];
  }
  return sqliteDb()
    .prepare(toSqliteSql(text))
    .all(...(params as never[])) as T[];
}

export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export async function execute(text: string, params: unknown[] = []): Promise<{ changes: number }> {
  await ensureSchema();
  if (storeMode() === "postgres") {
    const result = await pgQuery(text, params);
    return { changes: result.rowCount ?? 0 };
  }
  const result = sqliteDb()
    .prepare(toSqliteSql(text))
    .run(...(params as never[]));
  return { changes: Number(result.changes ?? 0) };
}

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await ensureSchema();
  if (storeMode() === "postgres") {
    const client = await pgPool().connect();
    try {
      await client.query("BEGIN");
      const value = await pgTx.run(client, fn);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  sqliteDb().exec("BEGIN IMMEDIATE");
  try {
    const value = await fn();
    sqliteDb().exec("COMMIT");
    return value;
  } catch (error) {
    sqliteDb().exec("ROLLBACK");
    throw error;
  }
}

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  draft_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS outbound_mail (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL,
  meta_json TEXT
);
CREATE TABLE IF NOT EXISTS planned_moments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_label TEXT NOT NULL,
  period TEXT NOT NULL,
  window_label TEXT NOT NULL,
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  last_snapshot_at TEXT,
  last_score_label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_label TEXT NOT NULL,
  period TEXT NOT NULL,
  last_opened_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorite_sports (
  user_id TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, sport_id)
);
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  weekend_focus INTEGER NOT NULL DEFAULT 1,
  uv_reminders INTEGER NOT NULL DEFAULT 1,
  save_plans_by_default INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS analysis_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  idempotency_key TEXT,
  sport_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_label TEXT NOT NULL,
  period TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, cache_key),
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_period ON analysis_ledger(user_id, period_key);
CREATE TABLE IF NOT EXISTS analysis_cache (
  cache_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_customers (
  user_id TEXT PRIMARY KEY,
  mollie_customer_id TEXT,
  mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_checkouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mollie_payment_id TEXT,
  mollie_customer_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  state TEXT NOT NULL,
  checkout_url TEXT,
  consent_at TEXT,
  idempotency_key TEXT UNIQUE,
  raw_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  state TEXT NOT NULL,
  mollie_subscription_id TEXT,
  mollie_customer_id TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  cancelled_at TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  checkout_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT NOT NULL,
  issued_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT UNIQUE,
  payment_id TEXT,
  processed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
`;

const PHASE0_TOKEN_MARKER = "phase0_invalidate_dev_tokens_v1";

function invalidateOutstandingSqliteTokens() {
  const database = sqliteDb();
  const existing = database.prepare("SELECT id FROM schema_migrations WHERE id = ?").get(PHASE0_TOKEN_MARKER) as
    | { id: string }
    | undefined;
  if (existing) return;
  const stamp = new Date().toISOString();
  database
    .prepare(
      `UPDATE tokens SET used_at = COALESCE(used_at, ?) WHERE used_at IS NULL AND purpose IN ('verify', 'reset')`,
    )
    .run(stamp);
  database
    .prepare("INSERT INTO schema_migrations (id, applied_at, note) VALUES (?, ?, ?)")
    .run(PHASE0_TOKEN_MARKER, stamp, "phase0");
}

async function ensureSchema() {
  if (globalStore.weersportSchemaReady) return;
  if (storeMode() === "postgres") {
    const dir = path.join(process.cwd(), "migrations");
    await pgPool().query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        note TEXT
      );
    `);
    if (existsSync(dir)) {
      const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
      for (const file of files) {
        const seen = await pgPool().query("SELECT id FROM schema_migrations WHERE id = $1", [file]);
        if ((seen.rowCount ?? 0) > 0) continue;
        const sql = readFileSync(path.join(dir, file), "utf8");
        await pgPool().query(sql);
        await pgPool().query("INSERT INTO schema_migrations (id, applied_at, note) VALUES ($1, NOW(), $2)", [
          file,
          "phase1",
        ]);
      }
    }
  } else {
    sqliteDb().exec(SQLITE_SCHEMA);
    invalidateOutstandingSqliteTokens();
  }
  globalStore.weersportSchemaReady = true;
}

/**
 * Sync SQLite accessor for request-path code until the async Postgres cutover.
 * DATABASE_URL enables durable schema/migration tooling via query()/execute();
 * sync auth/moments/billing keep using this file store in Phase 1.
 */
export function legacySqlite() {
  if (!globalStore.weersportSchemaReady || storeMode() === "postgres") {
    // Always ensure the local SQLite schema for sync callers, even when Postgres
    // is configured for migration readiness / mail log experiments.
    sqliteDb().exec(SQLITE_SCHEMA);
    try {
      invalidateOutstandingSqliteTokens();
    } catch {
      // first boot race
    }
    if (storeMode() !== "postgres") {
      globalStore.weersportSchemaReady = true;
    }
  }
  return sqliteDb();
}
