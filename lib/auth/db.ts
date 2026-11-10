import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Worker, MessageChannel, receiveMessageOnPort } from "node:worker_threads";
import { splitStatements, translateStatement } from "@/lib/auth/sql-compat";

export type StatementResult = { changes: number; lastInsertRowid: number | bigint };

export type AppDatabase = {
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): StatementResult;
  };
  exec(sql: string): void;
};

const AUTH_SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
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
`;

const globalStore = globalThis as unknown as {
  weersportDb?: AppDatabase;
  weersportDriver?: "sqlite" | "postgres";
};

export function db(): AppDatabase {
  const driver = process.env.DATABASE_URL ? "postgres" : "sqlite";
  if (!globalStore.weersportDb || globalStore.weersportDriver !== driver) {
    globalStore.weersportDb = driver === "postgres" ? openPostgres() : openSqlite();
    globalStore.weersportDriver = driver;
  }
  return globalStore.weersportDb;
}

function openSqlite(): AppDatabase {
  const file = process.env.WEERSPORT_DB ?? path.join(process.cwd(), "data", "weersport.sqlite");
  mkdirSync(path.dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec(AUTH_SCHEMA);
  return {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      return {
        get: (...params: unknown[]) => statement.get(...(params as never[])),
        all: (...params: unknown[]) => statement.all(...(params as never[])) as unknown[],
        run: (...params: unknown[]) => {
          const result = statement.run(...(params as never[]));
          return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
        },
      };
    },
    exec(sql: string) {
      database.exec(sql);
    },
  };
}

function openPostgres(): AppDatabase {
  const database = createPostgresDatabase();
  database.exec(AUTH_SCHEMA);
  return database;
}

type QueryResult = { rows: unknown[]; rowCount: number };

function createPostgresDatabase(): AppDatabase {
  const bridge = new PostgresBridge();
  return {
    prepare(sql: string) {
      const translated = translateStatement(sql);
      return {
        get(...params: unknown[]) {
          if (translated == null) return undefined;
          return bridge.query(translated, params).rows[0];
        },
        all(...params: unknown[]) {
          if (translated == null) return [];
          return bridge.query(translated, params).rows;
        },
        run(...params: unknown[]) {
          if (translated == null) return { changes: 0, lastInsertRowid: 0 };
          const result = bridge.query(translated, params);
          return { changes: result.rowCount, lastInsertRowid: 0 };
        },
      };
    },
    exec(sql: string) {
      for (const statement of splitStatements(sql)) {
        const translated = translateStatement(statement);
        if (translated == null) continue;
        bridge.query(translated, []);
      }
    },
  };
}

class PostgresBridge {
  private worker: Worker | null = null;
  private port: import("node:worker_threads").MessagePort | null = null;
  private flag: Int32Array | null = null;

  query(sql: string, params: unknown[]): QueryResult {
    this.ensure();
    Atomics.store(this.flag!, 0, 0);
    this.port!.postMessage({
      sql,
      params: params.map((value) => (value === undefined ? null : value)),
    });
    const status = Atomics.wait(this.flag!, 0, 0, 20000);
    if (status === "timed-out") {
      this.stop();
      throw new Error("database timed out");
    }
    const received = receiveMessageOnPort(this.port!);
    if (!received) throw new Error("database returned no result");
    const message = received.message as { ok: boolean; result?: QueryResult; error?: string };
    if (!message.ok) throw new Error(message.error || "database query failed");
    return message.result ?? { rows: [], rowCount: 0 };
  }

  private ensure() {
    if (this.worker && this.port && this.flag) return;
    const { port1, port2 } = new MessageChannel();
    const flag = new Int32Array(new SharedArrayBuffer(4));
    const worker = new Worker(path.join(process.cwd(), "lib/auth/pg-worker.mjs"));
    worker.unref();
    worker.on("error", () => {
      this.stop();
    });
    Atomics.store(flag, 0, 0);
    worker.postMessage({ port: port2, sharedBuffer: flag.buffer }, [port2]);
    const ready = Atomics.wait(flag, 0, 0, 10000);
    if (ready === "timed-out") {
      void worker.terminate();
      throw new Error("database worker did not start");
    }
    this.worker = worker;
    this.port = port1;
    this.flag = flag;
  }

  private stop() {
    const worker = this.worker;
    this.worker = null;
    this.port = null;
    this.flag = null;
    void worker?.terminate();
  }
}
