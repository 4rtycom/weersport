import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { invalidateOutstandingAuthTokens } from "@/lib/auth/token-migration";

const globalStore = globalThis as unknown as { weersportDb?: DatabaseSync; weersportTokenMigration?: boolean };

export function db() {
  if (!globalStore.weersportDb) {
    const file = process.env.WEERSPORT_DB ?? path.join(process.cwd(), "data", "weersport.sqlite");
    mkdirSync(path.dirname(file), { recursive: true });
    const database = new DatabaseSync(file);
    database.exec(`
      PRAGMA journal_mode = WAL;
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
    `);
    globalStore.weersportDb = database;
  }
  if (!globalStore.weersportTokenMigration) {
    // Set before running to avoid re-entry while invalidateOutstandingAuthTokens calls db().
    // Clear on failure so a later db() retries; leaving it set would skip token invalidation.
    globalStore.weersportTokenMigration = true;
    try {
      invalidateOutstandingAuthTokens();
    } catch (error) {
      globalStore.weersportTokenMigration = false;
      throw error;
    }
  }
  return globalStore.weersportDb;
}
