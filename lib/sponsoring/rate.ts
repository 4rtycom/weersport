export type RateMode = "example" | "confirmed";

export type ResolvedRate =
  | { ok: true; mode: RateMode; version: string; cents: number; currency: "EUR" }
  | { ok: false; error: string };

/**
 * € 29 excl. VAT is an example only. It is never implied.
 * A confirmed production rate needs WEERSPORT_SPONSOR_RATE_MODE=confirmed
 * and an explicit cent amount. Unknown fiscal setups have no default.
 */
export function resolveMonthlyRate(env: NodeJS.ProcessEnv = process.env): ResolvedRate {
  const mode = env.WEERSPORT_SPONSOR_RATE_MODE;
  if (mode !== "example" && mode !== "confirmed") {
    return { ok: false, error: "Het maandtarief is nog niet bevestigd." };
  }
  const cents = Number(env.WEERSPORT_SPONSOR_RATE_CENTS);
  if (!Number.isInteger(cents) || cents <= 0 || cents > 100_000) {
    return { ok: false, error: "Het maandtarief is nog niet bevestigd." };
  }
  const version =
    mode === "example"
      ? `example-${cents}`
      : (env.WEERSPORT_SPONSOR_RATE_VERSION?.trim() || `confirmed-${cents}`);
  return { ok: true, mode, version, cents, currency: "EUR" };
}
