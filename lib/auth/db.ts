/**
 * Compatibility shim — Phase 1 consolidates schema in lib/db/client.ts.
 * Sync callers keep using db(); Postgres cutover uses async query() from @/lib/db/client.
 */
export { legacySqlite as db, isDurableStore, storeMode } from "@/lib/db/client";
