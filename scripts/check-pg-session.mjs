import assert from "node:assert/strict";
import { createSessionRunner, WRITE_LOCK_SQL } from "../lib/auth/pg-session.mjs";

function client(fail) {
  return {
    queries: [],
    released: false,
    releaseError: undefined,
    async query(sql) {
      this.queries.push(sql);
      if (fail?.(sql)) {
        const error = new Error(`${sql} failed`);
        error.code = "40001";
        throw error;
      }
      return { rows: [], rowCount: 0 };
    },
    release(error) {
      if (this.released) throw new Error("client released twice");
      this.released = true;
      this.releaseError = error;
    },
  };
}

const opened = [];
const runner = createSessionRunner({
  async connect() {
    const row = client(opened.length === 0 ? (sql) => sql === "COMMIT" : undefined);
    opened.push(row);
    return row;
  },
  async query(sql) {
    return { rows: [{ sql }], rowCount: 1 };
  },
});

await runner.run("BEGIN IMMEDIATE");
assert.deepEqual(opened[0].queries, ["BEGIN", WRITE_LOCK_SQL]);
await assert.rejects(() => runner.run("COMMIT"), /COMMIT failed/);
assert.equal(opened[0].released, true);
assert.ok(opened[0].releaseError, "failed commit must discard the connection");
const next = await runner.run("SELECT 1");
assert.equal(next.rows[0].sql, "SELECT 1");
assert.equal(opened[0].queries.includes("SELECT 1"), false);
assert.equal(opened.length, 1);

const rollbackClients = [];
const rollbackRunner = createSessionRunner({
  async connect() {
    const row = client((sql) => sql === "SELECT boom" || sql === "ROLLBACK");
    rollbackClients.push(row);
    return row;
  },
  async query(sql) {
    if (sql === "SELECT boom") throw new Error("boom");
    return { rows: [], rowCount: 0 };
  },
});
await rollbackRunner.run("BEGIN IMMEDIATE");
await assert.rejects(() => rollbackRunner.run("SELECT boom"), /SELECT boom failed/);
assert.equal(rollbackClients[0].queries.at(-1), "ROLLBACK");
assert.ok(rollbackClients[0].releaseError, "failed rollback must discard the connection");
assert.equal(rollbackClients[0].released, true);

console.log("pg session ok");
