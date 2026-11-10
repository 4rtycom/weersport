import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { nodeFileTrace } = require("next/dist/compiled/@vercel/nft");
const root = process.cwd();

const dbSource = readFileSync(new URL("../lib/auth/db.ts", import.meta.url), "utf8");
if (!/import\s+["']pg["']/.test(dbSource) && !/from\s+["']pg["']/.test(dbSource)) {
  throw new Error("lib/auth/db.ts must statically import pg so the serverless trace includes it");
}

const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
if (!config.includes("./lib/auth/pg-worker.mjs") || !config.includes("./node_modules/pg/**/*")) {
  throw new Error("next.config.ts must include the worker and the pg package in the file trace");
}

const traced = await nodeFileTrace(
  [path.join(root, "lib/auth/db.ts"), path.join(root, "lib/auth/pg-worker.mjs")],
  { base: root },
);
const files = [...traced.fileList];
for (const required of [
  "node_modules/pg/package.json",
  "node_modules/pg-pool/package.json",
  "node_modules/pg-connection-string/package.json",
  "node_modules/pg-protocol/package.json",
  "node_modules/pg-types/package.json",
  "lib/auth/pg-worker.mjs",
  "lib/auth/pg-session.mjs",
]) {
  if (!files.some((file) => file.endsWith(required))) {
    throw new Error(`serverless file trace missed ${required}`);
  }
}

console.log("pg trace ok");
