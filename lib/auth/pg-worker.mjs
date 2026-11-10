import pg from "pg";
import { parentPort } from "node:worker_threads";
import { createSessionRunner } from "./pg-session.mjs";

pg.types.setTypeParser(20, (value) => Number(value));
pg.types.setTypeParser(1700, (value) => Number(value));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
});

const runner = createSessionRunner({
  connect: () => pool.connect(),
  query: (sql, params) => pool.query(sql, params),
});

function publicError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://redacted");
}

parentPort.on("message", (setup) => {
  const shared = new Int32Array(setup.sharedBuffer);
  setup.port.on("message", async (query) => {
    try {
      const result = await runner.run(query.sql, query.params ?? []);
      setup.port.postMessage({ ok: true, result });
    } catch (error) {
      setup.port.postMessage({
        ok: false,
        error: publicError(error),
        code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
      });
    } finally {
      Atomics.store(shared, 0, 1);
      Atomics.notify(shared, 0);
    }
  });
  Atomics.store(shared, 0, 1);
  Atomics.notify(shared, 0);
});
