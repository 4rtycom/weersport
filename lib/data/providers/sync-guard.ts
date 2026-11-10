import { timingSafeEqual } from "node:crypto";
import type { ProviderId } from "@/lib/data/providers/contracts";

const ALLOWED: ProviderId[] = ["knmi", "rws", "pdok", "luchtmeetnet"];
const hits = new Map<string, number[]>();

export function isProviderId(value: string): value is ProviderId {
  return (ALLOWED as string[]).includes(value);
}

export function syncAuthorized(header: string | null): boolean {
  const secret = process.env.DATA_SYNC_SECRET?.trim();
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const presented = header.slice("Bearer ".length);
  const left = Buffer.from(presented);
  const right = Buffer.from(secret);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function syncRateAllows(provider: ProviderId): boolean {
  const now = Date.now();
  const recent = (hits.get(provider) ?? []).filter((stamp) => now - stamp < 30_000);
  if (recent.length >= 1) {
    hits.set(provider, recent);
    return false;
  }
  recent.push(now);
  hits.set(provider, recent);
  return true;
}

export function resetSyncGuardForTests() {
  hits.clear();
}
