export type QaStatus = "GEAUTOMATISEERD" | "HANDMATIG_NODIG" | "BLOKKEREND";

export type QaCard = {
  id: string;
  title: string;
  criteria: string;
  status: QaStatus;
  evidence: string;
};

/**
 * H06 / Figma 314:8 — UAT matrix for /release-gate.
 * Classification honesty: visual/AT widths remain HANDMATIG_NODIG until Phase 7 packs are filled.
 */
export const RELEASE_QA_CARDS: QaCard[] = [
  {
    id: "QA0",
    title: "UI & RESPONSIVE",
    criteria:
      "320 / 390 / 768 / 1024 / 1440; visuele screenshotverschillen, geen clipping, focus en minimaal 44px aanraken.",
    status: "HANDMATIG_NODIG",
    evidence: "Phase 01 touch/token static + Phase 6/7 manual_uat screenshots (pack phase-6-exit).",
  },
  {
    id: "QA1",
    title: "24 SPORTPROFIELEN",
    criteria:
      "Alle 24 sporten, uren, berekeningen, beste tijdvak en consistent piek/badge; weights gemotiveerd/gevalideerd.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 03/04 engine invariants + check-phase04 sport loop.",
  },
  {
    id: "QA2",
    title: "SAFETY & UV",
    criteria: "NO_SCORE bij ontbrekende essentiële data; onweer / wind / water / ijs; waarschuwingen onafhankelijk.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 2–4 fixtures + recommendations kill switch keeps UV/warnings.",
  },
  {
    id: "QA3",
    title: "AUTHENTICATIE",
    criteria: "Geselecteerde sportdraft blijft na login, registratie, verificatie, reset en terugkeer intact.",
    status: "GEAUTOMATISEERD",
    evidence: "Gate A scripts (phase 0/1/02) — mailbox/log, no browser token reward.",
  },
  {
    id: "QA4",
    title: "VERBRUIK & CACHE",
    criteria:
      "5/100 per maand; gelijktijdige requests, race conditions, cachehits en providerfouten zonder dubbel afboeken.",
    status: "GEAUTOMATISEERD",
    evidence: "Gate B check-phase4 + legacy check-phase06 ledger.",
  },
  {
    id: "QA5",
    title: "MOLLIE",
    criteria:
      "Eerste betaling, pending, webhook retry, double event, mislukking, opzegging, refund, betaald-tot datum.",
    status: "GEAUTOMATISEERD",
    evidence: "Gate C sandbox check-phase5; live Mollie still PENDING in evidence pack.",
  },
  {
    id: "QA6",
    title: "ADSENSE & PRIVACY",
    criteria:
      "Cookie-CMP, uitsluitingen, nooit homepage/no-score/Pro/checkout; NoFill, CLS en geen valse advertentie.",
    status: "GEAUTOMATISEERD",
    evidence: "check-phase07 decideAdPlacement + consent withdrawal (Phase 6).",
  },
  {
    id: "QA7",
    title: "PERSOONLIJKE DATA",
    criteria: "Opgeslagen filters, favoriete sporten, tijdvakken, verwijderen/export, accountbeveiliging en rechten.",
    status: "GEAUTOMATISEERD",
    evidence: "check-phase05 + Phase 7 cross-account isolation + export smoke.",
  },
];

export const RELEASE_NO_GO = [
  "Misleidende of fictieve veiligheidsscore als veilig",
  "Ontbrekende KNMI/UV-alerts of verborgen kritieke info",
  "Foutieve facturering / onterechte Pro-toegang",
  "Gegevenslek of kapotte login",
  "Gebroken cookie-/privacyconsent of ads op verboden surfaces",
  "Rollback die Phase 0 recovery opnieuw opent of Mollie paid-events replayt",
];
