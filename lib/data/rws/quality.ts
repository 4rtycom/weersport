/** Aquo quality codes used by Rijkswaterstaat WaterWebservices. 99 is a gap. */

const REJECTED = new Set(["10"]);

export function interpretRwsQuality(code: string | null | undefined, numeric: number | null) {
  if (numeric === null || !Number.isFinite(numeric)) {
    return { value: null as number | null, accepted: false, gap: true };
  }
  const normalized = (code ?? "").trim();
  if (normalized === "99") return { value: null, accepted: false, gap: true };
  if (REJECTED.has(normalized)) return { value: null, accepted: false, gap: false };
  return { value: numeric, accepted: true, gap: false };
}

export function metresFrom(value: number, unit: string | null): number | null {
  const code = (unit ?? "").trim().toLowerCase();
  if (code === "m" || code === "meter") return value;
  if (code === "cm") return value / 100;
  if (code === "dm") return value / 10;
  if (code === "mm") return value / 1000;
  return null;
}
