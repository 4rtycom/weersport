import pg from "pg";
import { parentPort } from "node:worker_threads";

pg.types.setTypeParser(20, (value) => Number(value));
pg.types.setTypeParser(1700, (value) => Number(value));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
});

let transaction = null;

function publicError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://redacted");
}

async function releaseTransaction() {
  if (!transaction) return;
  const client = transaction;
  transaction = null;
  client.release();
}

async function run(sql, params) {
  const command = sql.trim().replace(/;$/, "").trim().toUpperCase();
  if (command === "BEGIN") {
    if (!transaction) {
      transaction = await pool.connect();
      await transaction.query("BEGIN");
    }
    return { rows: [], rowCount: 0 };
  }
  if (command === "COMMIT" || command === "ROLLBACK") {
    if (transaction) {
      try {
        await transaction.query(command);
      } finally {
        await releaseTransaction();
      }
    }
    return { rows: [], rowCount: 0 };
  }
  const runner = transaction ?? pool;
  const result = await runner.query(sql, params);
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
}

parentPort.on("message", (setup) => {
  const shared = new Int32Array(setup.sharedBuffer);
  setup.port.on("message", async (query) => {
    try {
      const result = await run(query.sql, query.params ?? []);
      setup.port.postMessage({ ok: true, result });
    } catch (error) {
      if (transaction) {
        try {
          await transaction.query("ROLLBACK");
        } catch {
          // The connection is discarded below.
        }
        await releaseTransaction();
      }
      setup.port.postMessage({ ok: false, error: publicError(error) });
    } finally {
      Atomics.store(shared, 0, 1);
      Atomics.notify(shared, 0);
    }
  });
  Atomics.store(shared, 0, 1);
  Atomics.notify(shared, 0);
});
