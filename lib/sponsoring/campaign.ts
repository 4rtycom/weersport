import { provinceFromDetail } from "@/lib/place-label";
import { addCalendarDays, amsterdamToday, isIsoDate } from "@/lib/sponsoring/period";

export const CAMPAIGN_REQUEST_TYPE = "campaign_v1";

export const AREA_CHOICES = [
  { value: "place", label: "Alleen deze plaats" },
  { value: "10", label: "Binnen 10 km" },
  { value: "25", label: "Binnen 25 km" },
  { value: "50", label: "Binnen 50 km" },
] as const;

export type AreaKind = "place" | "radius";

const IDEMPOTENCY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function plainLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function isEmailAddress(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && IDEMPOTENCY.test(value);
}

export function parseWeeks(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1 || value > 52) return null;
    return value;
  }
  if (typeof value !== "string" || !/^(?:[1-9]|[1-4]\d|5[0-2])$/.test(value.trim())) return null;
  return Number(value.trim());
}

export function parseCampaignStart(value: unknown, today = amsterdamToday()): { ok: true; value: string } | { ok: false } {
  if (typeof value !== "string" || !isIsoDate(value) || value < today) return { ok: false };
  return { ok: true, value };
}

/** Inclusive last campaign day: start + (7 × weeks − 1) calendar days. */
export function inclusiveCampaignEnd(startDate: string, weeks: number) {
  return addCalendarDays(startDate, weeks * 7 - 1);
}

export function parseAreaFields(
  areaKind: unknown,
  radiusKm: unknown,
): { areaKind: AreaKind; radiusKm: number | null } | null {
  if (areaKind === "place") {
    if (radiusKm != null && radiusKm !== "") return null;
    return { areaKind: "place", radiusKm: null };
  }
  if (areaKind !== "radius") return null;
  const km = typeof radiusKm === "string" && /^\d+$/.test(radiusKm) ? Number(radiusKm) : radiusKm;
  if (km === 10 || km === 25 || km === 50) return { areaKind: "radius", radiusKm: km };
  return null;
}

export function areaChoiceValue(areaKind: AreaKind | "", radiusKm: number | null) {
  if (areaKind === "place") return "place";
  if (areaKind === "radius" && (radiusKm === 10 || radiusKm === 25 || radiusKm === 50)) return String(radiusKm);
  return "";
}

export function areaFromChoice(choice: string): { areaKind: AreaKind; radiusKm: number | null } | null {
  if (choice === "place") return { areaKind: "place", radiusKm: null };
  if (choice === "10" || choice === "25" || choice === "50") {
    return { areaKind: "radius", radiusKm: Number(choice) };
  }
  return null;
}

export function reachLabel(areaKind: AreaKind, radiusKm: number | null) {
  if (areaKind === "place") return "Alleen deze plaats";
  return `Binnen ${radiusKm} km`;
}

export function summaryTitle(sportName: string, place: string, areaKind: AreaKind, radiusKm: number | null) {
  if (areaKind === "place") return `${sportName} · ${place}`;
  return `${sportName} · ${place} + ${radiusKm} km`;
}

export function weeksLabel(weeks: number) {
  return weeks === 1 ? "1 week" : `${weeks} weken`;
}

export function formatDutchDate(iso: string, withYear: boolean) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatPeriod(startDate: string, endDate: string) {
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  return `${formatDutchDate(startDate, !sameYear)} t/m ${formatDutchDate(endDate, true)}`;
}

export function provinceForPlace(detail: string, label: string) {
  return provinceFromDetail(detail, label);
}
