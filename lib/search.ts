import { dataFlagEnabled, DATA_FLAG } from "@/lib/data/flags";
import { findSport, periods } from "@/lib/sports";
import { resolveDutchPlace } from "@/lib/places";
import { parseDraft, type SearchDraft } from "@/lib/draft";

export async function prepareSearch(input: {
  sportId?: unknown;
  placeId?: unknown;
  placeLabel?: unknown;
  period?: unknown;
  sportSpot?: unknown;
}): Promise<{ ok: true; draft: SearchDraft } | { ok: false; error: string; status: number }> {
  const sport = typeof input.sportId === "string" ? findSport(input.sportId) : undefined;
  const known = typeof input.sportId === "string" && sport?.id === input.sportId;
  const period = periods.find((item) => item === input.period);
  if (!known || !sport || !period) {
    return { ok: false, status: 400, error: "Kies een sport en een periode." };
  }
  const placeId = typeof input.placeId === "string" ? input.placeId : "";
  const placeLabel = typeof input.placeLabel === "string" ? input.placeLabel.trim() : "";
  try {
    const place = await resolveDutchPlace(placeId, placeLabel);
    if (!place) {
      return { ok: false, status: 400, error: "Kies een woonplaats in Nederland." };
    }
    const draft = parseDraft({
      sportId: sport.id,
      placeId: place.id,
      placeLabel: place.label,
      period,
      ...(dataFlagEnabled(DATA_FLAG.pdokV2) && input.sportSpot ? { sportSpot: input.sportSpot } : {}),
    });
    if (!draft) {
      return {
        ok: false,
        status: 400,
        error: input.sportSpot && dataFlagEnabled(DATA_FLAG.pdokV2) ? "Ongeldige sportlocatie." : "Kies een woonplaats in Nederland.",
      };
    }
    return { ok: true, draft };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "De Nederlandse plaatscontrole is nu niet bereikbaar. Er is geen analyse gestart.",
    };
  }
}
