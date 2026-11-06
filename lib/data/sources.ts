/**
 * Phase 2 — approved commercial usage / attribution register per source.
 * Glenn must confirm paid rights before production claims that require a licensed feed.
 */

export type SourceRights = {
  sourceId: string;
  sourceLabel: string;
  category: "weather" | "warnings" | "water" | "swim" | "ice" | "geo";
  attribution: string;
  commercialStatus: "approved-open" | "pending-approval" | "not-linked" | "fixture-only";
  usageNote: string;
  attributionRequired: boolean;
};

export const SOURCE_RIGHTS: SourceRights[] = [
  {
    sourceId: "open-meteo",
    sourceLabel: "Open-Meteo",
    category: "weather",
    attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
    commercialStatus: "pending-approval",
    usageNote:
      "CC BY 4.0 allows use with attribution. Commercial vendor choice and SLA remain open until Glenn signs off.",
    attributionRequired: true,
  },
  {
    sourceId: "knmi-warnings",
    sourceLabel: "KNMI waarschuwingen",
    category: "warnings",
    attribution: "Waarschuwingen: KNMI (Nederland)",
    commercialStatus: "not-linked",
    usageNote:
      "Officiële waarschuwingen vereisen een goedgekeurde open-data of commerciële toegang plus hergebruikrechten. Zonder koppeling: NOT_LINKED, nooit verzonnen alerts.",
    attributionRequired: true,
  },
  {
    sourceId: "rws-wadar",
    sourceLabel: "RWS WADAR / Waterinfo",
    category: "water",
    attribution: "Waterdata: Rijkswaterstaat",
    commercialStatus: "not-linked",
    usageNote:
      "Meetpunten zijn lokaal. Een woonplaatscentroïde dekt geen specifiek waterlichaam. Geen veilige-waterclaim zonder gekoppelde dekking.",
    attributionRequired: true,
  },
  {
    sourceId: "zwemwater-bij12",
    sourceLabel: "Zwemwater / BIJ12",
    category: "swim",
    attribution: "Zwemwaterstatus: officiële zwemwaterinformatie (BIJ12 / provincies)",
    commercialStatus: "not-linked",
    usageNote: "Alleen tijdige officiële status. Geen geïmproviseerd zwemadvies.",
    attributionRequired: true,
  },
  {
    sourceId: "ice-evidence",
    sourceLabel: "IJs Evidentiestandaard",
    category: "ice",
    attribution: "Geen ijsbron gekoppeld",
    commercialStatus: "not-linked",
    usageNote:
      "Natuurijs wordt nooit veilig verklaard op luchttemperatuur. Zonder ijsdikte/kwaliteitsbron: NO_SCORE.",
    attributionRequired: false,
  },
  {
    sourceId: "pdok-geo",
    sourceLabel: "PDOK Locatieserver",
    category: "geo",
    attribution: "Locaties: PDOK Locatieserver",
    commercialStatus: "approved-open",
    usageNote: "Nederlandse woonplaats/adresresolutie. Centroïde is geen sitespecifieke water/ijsdekking.",
    attributionRequired: true,
  },
];

export function rightsFor(sourceId: string) {
  return SOURCE_RIGHTS.find((item) => item.sourceId === sourceId) ?? null;
}
