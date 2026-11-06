import { db } from "@/lib/auth/db";

let ready = false;

const REQUEST_COLUMNS: Array<[string, string]> = [
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
  ["request_type", "TEXT"],
  ["area_kind", "TEXT"],
  ["radius_km", "INTEGER"],
  ["duration_weeks", "INTEGER"],
  ["end_date", "TEXT"],
  ["province", "TEXT"],
  ["idempotency_key", "TEXT"],
];

const REQUEST_TABLE = `
  CREATE TABLE sponsorship_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    organisation TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT,
    inbox TEXT,
    created_at TEXT NOT NULL,
    intent TEXT,
    inquiry TEXT,
    sport_id TEXT,
    place_id TEXT,
    place_label TEXT,
    desired_start TEXT,
    quoted_price_cents INTEGER,
    quoted_days INTEGER,
    status TEXT,
    agreed_price_cents INTEGER,
    agreed_at TEXT,
    price_kind TEXT,
    request_type TEXT,
    area_kind TEXT,
    radius_km INTEGER,
    duration_weeks INTEGER,
    end_date TEXT,
    province TEXT,
    idempotency_key TEXT
  );
`;

type ColumnInfo = { name: string; notnull: number };

function tableColumns(database: ReturnType<typeof db>) {
  return database.prepare("PRAGMA table_info(sponsorship_requests)").all() as ColumnInfo[];
}

/**
 * Older databases require a message. Campaign requests have no free-text message,
 * so the column becomes nullable without inventing one. Rows are copied across.
 */
function relaxMessageColumn(database: ReturnType<typeof db>, columns: ColumnInfo[]) {
  const message = columns.find((column) => column.name === "message");
  if (!message || message.notnull !== 1) return;
  const known = new Set(REQUEST_COLUMNS.map(([name]) => name).concat([
    "id",
    "name",
    "organisation",
    "email",
    "message",
    "inbox",
    "created_at",
  ]));
  const copy = columns.map((column) => column.name).filter((name) => known.has(name));
  const list = copy.join(", ");
  database.exec("DROP TABLE IF EXISTS sponsorship_requests_next");
  database.exec(REQUEST_TABLE.replace("CREATE TABLE sponsorship_requests", "CREATE TABLE sponsorship_requests_next"));
  database.exec(`INSERT INTO sponsorship_requests_next (${list}) SELECT ${list} FROM sponsorship_requests`);
  database.exec("DROP TABLE sponsorship_requests");
  database.exec("ALTER TABLE sponsorship_requests_next RENAME TO sponsorship_requests");
}

export function ensureSponsorSchema() {
  if (ready) return;
  const database = db();
  const exists = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sponsorship_requests'")
    .get() as { name: string } | undefined;
  if (!exists) {
    database.exec(REQUEST_TABLE);
  } else {
    const have = new Set(tableColumns(database).map((column) => column.name));
    for (const [name, type] of REQUEST_COLUMNS) {
      if (!have.has(name)) database.exec(`ALTER TABLE sponsorship_requests ADD COLUMN ${name} ${type}`);
    }
    relaxMessageColumn(database, tableColumns(database));
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
    CREATE UNIQUE INDEX IF NOT EXISTS sponsorship_requests_idempotency
      ON sponsorship_requests (idempotency_key);
  `);
  ready = true;
}

/** Test helper. Production code keeps the schema for the process lifetime. */
export function resetSponsorSchemaForTests() {
  ready = false;
}
