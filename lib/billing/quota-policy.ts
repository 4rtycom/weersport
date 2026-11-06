/**
 * Phase 4 — quota period policy (pending Glenn sign-off for customer copy).
 *
 * - Timezone: Europe/Amsterdam
 * - Period: calendar month (`YYYY-MM`)
 * - Reset: 00:00 on the 1st of each Amsterdam month
 * - Basis: 5 successful new SCORED analyses / period
 * - Pro: 100 successful new SCORED analyses / period
 * - NO_SCORE, provider failure, cache hits and saved plans do not consume
 * - Safety + UV remain available when allowance is exhausted
 */

export const QUOTA_TIMEZONE = "Europe/Amsterdam";
export const QUOTA_PERIOD_KIND = "calendar-month" as const;

export const QUOTA_POLICY_SUMMARY =
  "Analysequota telt per kalendermaand in Europe/Amsterdam. Reset op de 1e om 00:00 lokale tijd. Alleen nieuwe geslaagde scores tellen; NO_SCORE, cachehits en opgeslagen plannen niet. UV en waarschuwingen blijven beschikbaar bij een leeg quotum.";
