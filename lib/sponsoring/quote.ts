import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { formatEuroCents } from "@/lib/sponsoring/months";
import { resolveMonthlyRate, type RateMode } from "@/lib/sponsoring/rate";
import { sports } from "@/lib/sports";

const VAT_RATE = 21;
const QUOTE_TTL_MS = 30 * 60 * 1000;

export type QuoteLine = {
  sportId: string;
  sportName: string;
  netCents: number;
  vatCents: number;
  grossCents: number;
  vatRate: "21.00";
};

export type SponsorQuote = {
  id: string;
  sportIds: string[];
  country: string;
  rateVersion: string;
  rateCents: number;
  rateMode: RateMode;
  netCents: number;
  vatCents: number;
  grossCents: number;
  lines: QuoteLine[];
  expiresAt: string;
  label: string;
};

export function uniqueKnownSports(sportIds: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(sportIds)) return { ok: false, error: "Kies één tot 24 sporten." };
  const ids = sportIds.filter((id): id is string => typeof id === "string");
  if (ids.length !== sportIds.length) return { ok: false, error: "Kies één tot 24 sporten." };
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Elke sport kan één keer gekozen worden." };
  if (ids.length < 1 || ids.length > 24) return { ok: false, error: "Kies één tot 24 sporten." };
  const known = new Set(sports.map((sport) => sport.id));
  if (ids.some((id) => !known.has(id))) return { ok: false, error: "Onbekende sport. Er is niets besteld." };
  return { ok: true, ids };
}

export function lineVatCents(netCents: number) {
  return Math.round((netCents * VAT_RATE) / 100);
}

export function buildLines(sportIds: string[], rateCents: number): QuoteLine[] {
  return sportIds.map((sportId) => {
    const sport = sports.find((item) => item.id === sportId);
    const netCents = rateCents;
    const vatCents = lineVatCents(netCents);
    return {
      sportId,
      sportName: sport?.name ?? sportId,
      netCents,
      vatCents,
      grossCents: netCents + vatCents,
      vatRate: "21.00",
    };
  });
}

export function createQuote(input: { sportIds: unknown; country: unknown; now?: Date }):
  | { ok: true; quote: SponsorQuote }
  | { ok: false; status: number; error: string; field?: string } {
  const sportsResult = uniqueKnownSports(input.sportIds);
  if (!sportsResult.ok) return { ok: false, status: 400, error: sportsResult.error, field: "sports" };
  const country = typeof input.country === "string" ? input.country.trim().toUpperCase() : "";
  if (country !== "NL") {
    return {
      ok: false,
      status: 400,
      error: "Facturatie buiten Nederland is nog niet beschikbaar.",
      field: "country",
    };
  }
  const rate = resolveMonthlyRate();
  if (!rate.ok) return { ok: false, status: 409, error: rate.error, field: "rate" };
  ensureCommercialSchema();
  const lines = buildLines(sportsResult.ids, rate.cents);
  const netCents = lines.reduce((sum, line) => sum + line.netCents, 0);
  const vatCents = lines.reduce((sum, line) => sum + line.vatCents, 0);
  const grossCents = netCents + vatCents;
  const now = input.now ?? new Date();
  const quote: SponsorQuote = {
    id: randomUUID(),
    sportIds: sportsResult.ids,
    country,
    rateVersion: rate.version,
    rateCents: rate.cents,
    rateMode: rate.mode,
    netCents,
    vatCents,
    grossCents,
    lines,
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
    label:
      rate.mode === "example"
        ? `Voorbeeldtarief ${formatEuroCents(rate.cents)} excl. btw per sport. Dit is geen productietarief.`
        : `${formatEuroCents(rate.cents)} excl. btw per sport.`,
  };
  db()
    .prepare(
      `INSERT INTO sponsor_quotes (
        id, sport_ids, country, rate_version, rate_cents, rate_mode, net_cents, vat_cents, gross_cents,
        lines_json, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      quote.id,
      JSON.stringify(quote.sportIds),
      quote.country,
      quote.rateVersion,
      quote.rateCents,
      quote.rateMode,
      quote.netCents,
      quote.vatCents,
      quote.grossCents,
      JSON.stringify(quote.lines),
      quote.expiresAt,
      now.toISOString(),
    );
  return { ok: true, quote };
}

export function readQuote(id: string): SponsorQuote | null {
  ensureCommercialSchema();
  const row = db().prepare("SELECT * FROM sponsor_quotes WHERE id = ?").get(id) as
    | {
        id: string;
        sport_ids: string;
        country: string;
        rate_version: string;
        rate_cents: number;
        rate_mode: string;
        net_cents: number;
        vat_cents: number;
        gross_cents: number;
        lines_json: string;
        expires_at: string;
      }
    | undefined;
  if (!row || (row.rate_mode !== "example" && row.rate_mode !== "confirmed")) return null;
  return {
    id: row.id,
    sportIds: JSON.parse(row.sport_ids) as string[],
    country: row.country,
    rateVersion: row.rate_version,
    rateCents: row.rate_cents,
    rateMode: row.rate_mode,
    netCents: row.net_cents,
    vatCents: row.vat_cents,
    grossCents: row.gross_cents,
    lines: JSON.parse(row.lines_json) as QuoteLine[],
    expiresAt: row.expires_at,
    label: "",
  };
}

export function quoteFingerprint(quote: Pick<SponsorQuote, "id" | "sportIds" | "grossCents" | "rateVersion">) {
  return createHash("sha256")
    .update(JSON.stringify({ id: quote.id, sportIds: quote.sportIds, grossCents: quote.grossCents, rateVersion: quote.rateVersion }))
    .digest("hex");
}
