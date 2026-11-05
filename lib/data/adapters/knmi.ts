import type { SourceObservation, WarningBundle } from "@/lib/data/types";

/**
 * KNMI open-data API requires an authorized key (verified: 401 without Authorization).
 * Until a key and reuse rights are configured, this adapter stays NOT_LINKED and never invents alerts.
 */
export async function fetchKnmiWarnings(placeLabel: string): Promise<SourceObservation<WarningBundle>> {
  const key = process.env.KNMI_API_KEY?.trim();
  const receivedAt = new Date().toISOString();
  if (!key) {
    return {
      sourceId: "knmi-warnings",
      sourceLabel: "KNMI waarschuwingen",
      status: "NOT_LINKED",
      rightsNote: "KNMI open-data vereist een API-sleutel en expliciete hergebruikrechten.",
      coverageNote: "Gebiedsgerichte officiële waarschuwingen voor Nederland.",
      publishedAt: null,
      receivedAt,
      validUntil: null,
      locationLabel: placeLabel,
      demo: false,
      value: { items: [] },
      message: "Bron niet gekoppeld / geen veiligheidsoordeel",
    };
  }

  // Key present but endpoint contract not finalized in this repo: refuse to invent payloads.
  return {
    sourceId: "knmi-warnings",
    sourceLabel: "KNMI waarschuwingen",
    status: "NOT_LINKED",
    rightsNote: "KNMI-sleutel is gezet, maar de waarschuwingsendpoint is nog niet aangesloten.",
    coverageNote: "Gebiedsgerichte officiële waarschuwingen voor Nederland.",
    publishedAt: null,
    receivedAt,
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: { items: [] },
    message: "Bron niet gekoppeld / geen veiligheidsoordeel",
  };
}
