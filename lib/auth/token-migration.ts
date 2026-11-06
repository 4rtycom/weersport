import { db } from "@/lib/auth/db";

const MARKER = "phase0_invalidate_dev_tokens_v1";

/**
 * One-shot: mark outstanding verify/reset tokens used so browser-delivered
 * development links stop working after Phase 0 containment. Preserves users.
 */
export function invalidateOutstandingAuthTokens(reason = MARKER) {
  const database = db();
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL,
      note TEXT
    );
  `);
  const existing = database.prepare("SELECT id FROM schema_migrations WHERE id = ?").get(MARKER) as
    | { id: string }
    | undefined;
  if (existing) {
    return { applied: false, alreadyApplied: true, invalidated: 0 };
  }

  const stamp = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = database
      .prepare(
        `UPDATE tokens
         SET used_at = COALESCE(used_at, ?)
         WHERE used_at IS NULL AND purpose IN ('verify', 'reset')`,
      )
      .run(stamp);
    database
      .prepare("INSERT INTO schema_migrations (id, applied_at, note) VALUES (?, ?, ?)")
      .run(MARKER, stamp, reason);
    database.exec("COMMIT");
    return { applied: true, alreadyApplied: false, invalidated: Number(result.changes ?? 0) };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function clearTokenInvalidationMarker() {
  db().prepare("DELETE FROM schema_migrations WHERE id = ?").run(MARKER);
}

/** Ensure Phase 0 migration runs once for SQLite processes. */
let ran = false;
export function ensurePhase0TokenMigration() {
  if (ran) return;
  ran = true;
  try {
    invalidateOutstandingAuthTokens();
  } catch {
    // Schema may not exist yet on first boot before tables are created.
  }
}
