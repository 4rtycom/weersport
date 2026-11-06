export type QaStatus = "GEAUTOMATISEERD" | "HANDMATIG_NODIG" | "BLOKKEREND";

export type QaCard = {
  id: string;
  title: string;
  criteria: string;
  status: QaStatus;
  evidence: string;
};

/** H06 / Figma 314:8 — verplichte UAT-matrix voor Phase 08 release gate. */
export const RELEASE_QA_CARDS: QaCard[] = [
  {
    id: "QA0",
    title: "UI & RESPONSIVE",
    criteria:
      "320 / 390 / 768 / 1024 / 1440; visuele screenshotverschillen, geen clipping, focus en minimaal 44px aanraken.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 01 touch/token checks + release-gate a11y/skip-link asserts.",
  },
  {
    id: "QA1",
    title: "24 SPORTPROFIELEN",
    criteria:
      "Alle 24 sporten, uren, berekeningen, beste tijdvak en consistent piek/badge; weights gemotiveerd/gevalideerd.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 04 engine + check-phase04 sport loop.",
  },
  {
    id: "QA2",
    title: "SAFETY & UV",
    criteria: "NO_SCORE bij ontbrekende essentiële data; onweer / wind / water / ijs; waarschuwingen onafhankelijk.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 03/04 NO_SCORE + bronstatus NOT_LINKED zonder veilige claim.",
  },
  {
    id: "QA3",
    title: "AUTHENTICATIE",
    criteria: "Geselecteerde sportdraft blijft na login, registratie, verificatie, reset en terugkeer intact.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 02 draft/auth routes.",
  },
  {
    id: "QA4",
    title: "VERBRUIK & CACHE",
    criteria:
      "5/100 per maand; gelijktijdige requests, race conditions, cachehits en providerfouten zonder dubbel afboeken.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 06 ledger BEGIN IMMEDIATE + idempotency checks.",
  },
  {
    id: "QA5",
    title: "MOLLIE",
    criteria:
      "Eerste betaling, pending, webhook retry, double event, mislukking, opzegging, refund, betaald-tot datum.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 06 verify-before-Pro + Phase 08 sandbox refund route.",
  },
  {
    id: "QA6",
    title: "ADSENSE & PRIVACY",
    criteria:
      "Cookie-CMP, uitsluitingen, nooit homepage/no-score/Pro/checkout; NoFill, CLS en geen valse advertentie.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 07 decideAdPlacement + cookie consent.",
  },
  {
    id: "QA7",
    title: "PERSOONLIJKE DATA",
    criteria: "Opgeslagen filters, favoriete sporten, tijdvakken, verwijderen/export, accountbeveiliging en rechten.",
    status: "GEAUTOMATISEERD",
    evidence: "Phase 05 saves + Phase 08 /api/account/export|delete.",
  },
];

export const RELEASE_NO_GO = [
  "Misleidende of fictieve veiligheidsscore als veilig",
  "Ontbrekende KNMI/UV-alerts of verborgen kritieke info",
  "Foutieve facturering / onterechte Pro-toegang",
  "Gegevenslek of kapotte login",
  "Gebroken cookie-/privacyconsent of ads op verboden surfaces",
];
