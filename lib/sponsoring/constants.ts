/** Standard pilot quote. Public requests may store this figure; they cannot authorise it. */
export const PILOT_PRICE_CENTS = 9900;
/** Internally agreed complimentary measurement pilot. Never offered by the public form. */
export const COMPLIMENTARY_PRICE_CENTS = 0;
export const PILOT_DAYS = 28;
export const PILOT_TIMEZONE = "Europe/Amsterdam";

export const MEASUREMENT_DEFINITION =
  "Een zichtbare vertoning telt als minstens de helft van de partnervermelding één aaneengesloten seconde zichtbaar is in een actief tabblad. Onderbreking zet de teller terug. Elke weergegeven plaatsing telt één keer. Een klik is een bewuste activatie van de sponsorlink.";

export const MEASUREMENT_LIMITATION =
  "Meting gebeurt alleen na cookie-toestemming. Ontbrekende toestemming, een inactief tabblad of een onderbroken seconde telt niet mee. Klikken zijn geen unieke sporters, winkelbezoek of omzet.";

/** Paid pilot stays closed until placement, measurement, follow-up and export are verified after a restart. */
export function pilotBookable() {
  return process.env.WEERSPORT_SPONSOR_PILOT_BOOKABLE === "1";
}

export function pilotCta(bookable = pilotBookable()) {
  return bookable ? "Vraag deze pilot aan" : "Vraag informatie over de pilot";
}

/**
 * Test campaigns render on the local dev server so the flow can be exercised.
 * Production hides them unless WEERSPORT_SPONSOR_ALLOW_TEST=1.
 */
export function allowTestCampaigns() {
  if (process.env.WEERSPORT_SPONSOR_ALLOW_TEST === "1") return true;
  if (process.env.WEERSPORT_SPONSOR_ALLOW_TEST === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/** Unsigned measurement tokens are refused in production. Local dev uses a fixed secret. */
export function eventSecret() {
  const configured = process.env.WEERSPORT_SPONSOR_EVENT_SECRET?.trim() ?? "";
  if (configured.length >= 16) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return "weersport-dev-sponsor-event-secret";
}
