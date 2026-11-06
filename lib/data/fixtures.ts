import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Deterministic Phase 2 fixtures. Enabled only when WEERSPORT_SOURCE_FIXTURES is set
 * and never treated as live production evidence.
 */
export function fixturesEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.WEERSPORT_SOURCE_FIXTURES === "1";
}

export function fixtureName(envKey: string, fallback: string) {
  return (process.env[envKey] ?? fallback).trim();
}

export function loadFixtureJson<T>(relativeName: string): T {
  const file = path.join(process.cwd(), "fixtures", "phase2", relativeName.endsWith(".json") ? relativeName : `${relativeName}.json`);
  if (!existsSync(file)) {
    throw new Error(`Phase 2 fixture missing: ${file}`);
  }
  return JSON.parse(readFileSync(file, "utf8")) as T;
}
