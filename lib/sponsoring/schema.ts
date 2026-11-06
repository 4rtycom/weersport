import { db } from "@/lib/auth/db";

let ready = false;

export function ensureSponsorSchema() {
  if (ready) return;
  const database = db();
  database.exec(`
    CREATE TABLE IF NOT EXISTS sponsorship_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      organisation TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      inbox TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const columns = database.prepare("PRAGMA table_info(sponsorship_requests)").all() as { name: string }[];
  const have = new Set(columns.map((column) => column.name));
  const additions: Array<[string, string]> = [
    ["intent", "TEXT"],
    ["inquiry", "TEXT"],
    ["sport_id", "TEXT"],
    ["place_id", "TEXT"],
    ["place_label", "TEXT"],
    ["desired_start", "TEXT"],
    ["quoted_price_cents", "INTEGER"],
    ["quoted_days", "INTEGER"],
    ["status", "TEXT"],
    ["agreed_price_cents", "INTEGER"],
    ["agreed_at", "TEXT"],
    ["price_kind", "TEXT"],
  ];
  for (const [name, type] of additions) {
    if (!have.has(name)) database.exec(`ALTER TABLE sponsorship_requests ADD COLUMN ${name} ${type}`);
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS sponsor_campaigns (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      sport_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      place_label TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      headline TEXT NOT NULL,
      body TEXT NOT NULL,
      destination_url TEXT,
      agreed_at TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      price_kind TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL,
      audience TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sponsor_campaigns_slot
      ON sponsor_campaigns (sport_id, place_id, starts_at, ends_at);
    CREATE TABLE IF NOT EXISTS sponsor_events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      placement_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sponsor_events_campaign ON sponsor_events (campaign_id, kind);
  `);
  ready = true;
}

/** Test helper. Production code keeps the schema for the process lifetime. */
export function resetSponsorSchemaForTests() {
  ready = false;
}
