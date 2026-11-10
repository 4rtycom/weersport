import type { KnmiMatch } from "@/lib/data/knmi/ingest";
import type { SafetyState } from "@/lib/data/types";

const RANK = { geel: 1, oranje: 2, rood: 3 } as const;

export function safetyFromWarnings(match: KnmiMatch): SafetyState {
  const top = match.items.reduce<(typeof RANK)[keyof typeof RANK] | 0>((best, item) => {
    const rank = item.code ? RANK[item.code] : 0;
    return rank > best ? rank : best;
  }, 0);
  if (match.status === "STALE" && top === 0) {
    return { level: "UNKNOWN", summary: match.message, comfortIsNotSafety: true };
  }
  if (match.status === "NOT_LINKED" || match.status === "ERROR" || match.status === "MISSING_CRITICAL" || match.status === "TEST_ONLY") {
    return { level: "UNKNOWN", summary: match.message, comfortIsNotSafety: true };
  }
  if (top >= RANK.rood) return { level: "RED", summary: match.message, comfortIsNotSafety: true };
  if (top >= RANK.oranje) return { level: "ORANGE", summary: match.message, comfortIsNotSafety: true };
  if (top >= RANK.geel) return { level: "YELLOW", summary: match.message, comfortIsNotSafety: true };
  if (match.status === "READY") return { level: "NONE_IN_WINDOW", summary: match.message, comfortIsNotSafety: true };
  return { level: "UNKNOWN", summary: match.message, comfortIsNotSafety: true };
}
