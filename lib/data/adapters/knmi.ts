import {
  WARNING_STALE_AFTER_MS,
  isStale,
  type WarningLifecycle,
} from "@/lib/data/contracts";
import { fixtureName, fixturesEnabled, loadFixtureJson } from "@/lib/data/fixtures";
import { rightsFor } from "@/lib/data/sources";
import type { SourceObservation, WarningBundle } from "@/lib/data/types";

type KnmiFixture = {
  lifecycle: WarningLifecycle;
  status: SourceObservation<WarningBundle>["status"];
  publishedAt: string | null;
  validUntil: string | null;
  lastSuccessAt: string | null;
  spatialCoverage: string | null;
  items: WarningBundle["items"];
  error?: string;
};

function baseRights() {
  return rightsFor("knmi-warnings")!;
}

function notLinked(placeLabel: string, message: string): SourceObservation<WarningBundle> {
  const rights = baseRights();
  return {
    sourceId: "knmi-warnings",
    sourceLabel: rights.sourceLabel,
    status: "NOT_LINKED",
    rightsNote: rights.usageNote,
    coverageNote: "Gebiedsgerichte officiële waarschuwingen voor Nederland.",
    publishedAt: null,
    receivedAt: new Date().toISOString(),
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: {
      lifecycle: "not-linked",
      spatialCoverage: null,
      lastSuccessAt: null,
      items: [],
    },
    message,
  };
}

function fromFixture(placeLabel: string, fixture: KnmiFixture): SourceObservation<WarningBundle> {
  const rights = baseRights();
  const receivedAt = new Date().toISOString();
  let status = fixture.status;
  let lifecycle = fixture.lifecycle;
  if (
    fixture.lastSuccessAt &&
    isStale(fixture.lastSuccessAt, WARNING_STALE_AFTER_MS) &&
    lifecycle !== "provider-failure" &&
    lifecycle !== "not-linked"
  ) {
    status = "STALE";
    lifecycle = "stale";
  }
  const message =
    lifecycle === "verified-all-clear"
      ? "Fixture: geverifieerde all-clear (geen actieve waarschuwing)."
      : lifecycle === "active-warning"
        ? "Fixture: actieve officiële waarschuwing — geen live KNMI-claim."
        : lifecycle === "stale"
          ? "Fixture: laatste succesvolle fetch is verouderd."
          : lifecycle === "provider-failure"
            ? fixture.error ?? "Fixture: providerfout."
            : lifecycle === "partial-coverage"
              ? "Fixture: partiële ruimtelijke dekking."
              : "Fixture: KNMI-status.";

  return {
    sourceId: "knmi-warnings",
    sourceLabel: rights.sourceLabel,
    status,
    rightsNote: `${rights.usageNote} · TEST_ONLY fixture`,
    coverageNote: fixture.spatialCoverage ?? "Onbekende ruimtelijke dekking.",
    publishedAt: fixture.publishedAt,
    receivedAt,
    validUntil: fixture.validUntil,
    locationLabel: placeLabel,
    demo: true,
    value: {
      lifecycle,
      spatialCoverage: fixture.spatialCoverage,
      lastSuccessAt: fixture.lastSuccessAt,
      items: fixture.items,
    },
    message,
  };
}

/**
 * KNMI open-data requires authorized access. Without Glenn-approved keys/rights this
 * adapter stays NOT_LINKED and never invents live alerts. Fixtures are opt-in for Gate evidence.
 */
export async function fetchKnmiWarnings(placeLabel: string): Promise<SourceObservation<WarningBundle>> {
  if (fixturesEnabled()) {
    const name = fixtureName("WEERSPORT_KNMI_FIXTURE", "all-clear");
    const fixture = loadFixtureJson<KnmiFixture>(`knmi-${name}`);
    return fromFixture(placeLabel, fixture);
  }

  const key = process.env.KNMI_API_KEY?.trim();
  if (!key) {
    return notLinked(placeLabel, "Bron niet gekoppeld / geen veiligheidsoordeel");
  }

  // Key present but endpoint contract not finalized: refuse to invent payloads.
  return notLinked(
    placeLabel,
    "KNMI-sleutel is gezet, maar de waarschuwingsendpoint is nog niet aangesloten.",
  );
}
