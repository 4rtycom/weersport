/** Transaction client used by the Postgres worker. No database driver import. */

export const WRITE_LOCK_SQL = "SELECT pg_advisory_xact_lock(842150450)";

export function createSessionRunner({ connect, query }) {
  let transaction = null;

  async function discard(error) {
    if (!transaction) return;
    const client = transaction;
    transaction = null;
    client.release(error);
  }

  async function abortOpenTransaction() {
    if (!transaction) return;
    const client = transaction;
    try {
      await client.query("ROLLBACK");
      transaction = null;
      client.release();
    } catch (error) {
      transaction = null;
      client.release(error);
    }
  }

  async function endTransaction(command) {
    if (!transaction) return { rows: [], rowCount: 0 };
    const client = transaction;
    try {
      await client.query(command);
      transaction = null;
      client.release();
    } catch (error) {
      transaction = null;
      client.release(error);
      throw error;
    }
    return { rows: [], rowCount: 0 };
  }

  return {
    async run(sql, params = []) {
      const command = sql.trim().replace(/;$/, "").trim().toUpperCase();
      try {
        if (
          command === "BEGIN" ||
          command === "BEGIN DEFERRED" ||
          command === "BEGIN IMMEDIATE" ||
          command === "BEGIN EXCLUSIVE"
        ) {
          if (!transaction) {
            transaction = await connect();
            try {
              await transaction.query("BEGIN");
              if (command === "BEGIN IMMEDIATE" || command === "BEGIN EXCLUSIVE") {
                await transaction.query(WRITE_LOCK_SQL);
              }
            } catch (error) {
              await discard(error);
              throw error;
            }
          }
          return { rows: [], rowCount: 0 };
        }
        if (command === "COMMIT" || command === "ROLLBACK") return endTransaction(command);
        const runner = transaction ?? { query };
        const result = await runner.query(sql, params);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      } catch (error) {
        if (command !== "COMMIT" && command !== "ROLLBACK") await abortOpenTransaction();
        throw error;
      }
    },
  };
}
