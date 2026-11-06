import { WATER_STALE_AFTER_MS, isStale } from "@/lib/data/contracts";
import {
  fixtureName,
  fixturesEnabled,
  loadFixtureJson,
  stableFixtureInstant,
} from "@/lib/data/fixtures";
import { rightsFor } from "@/lib/data/sources";
import type { SourceObservation, WaterBundle } from "@/lib/data/types";

type WaterFixture = {
  status: SourceObservation<WaterBundle>["status"];
  publishedAt: string | null;
  value: WaterBundle | null;
  stationLabel?: string;
  note?: string;
};

/**
 * RWS WADAR / Waterinfo. Live coupling awaits approved access.
 * Fixtures may return READY values, but snapshot coverage still refuses town-centroid scoring.
 */
export async function fetchRwsWater(placeLabel: string): Promise<SourceObservation<WaterBundle>> {
  const rights = rightsFor("rws-wadar")!;
  if (fixturesEnabled()) {
    const name = fixtureName("WEERSPORT_WATER_FIXTURE", "ready-town");
    const fixture = loadFixtureJson<WaterFixture>(`water-${name}`);
    const staleScenario = fixture.status === "STALE";
    const publishedAt = stableFixtureInstant(
      fixture.publishedAt,
      WATER_STALE_AFTER_MS,
      staleScenario,
    );
    const stale = publishedAt ? isStale(publishedAt, WATER_STALE_AFTER_MS) : false;
    return {
      sourceId: "rws-wadar",
      sourceLabel: rights.sourceLabel,
      status: stale ? "STALE" : fixture.status,
      rightsNote: `${rights.usageNote} · TEST_ONLY fixture`,
      coverageNote:
        fixture.note ??
        "Meetpunt is niet representatief voor elk watergebied of voor een woonplaatscentroïde.",
      publishedAt,
      receivedAt: new Date().toISOString(),
      validUntil: null,
      locationLabel: fixture.stationLabel ?? placeLabel,
      demo: true,
      value: fixture.value,
      message: stale
        ? "Fixture waterdata is verouderd."
        : "Fixture waterdata geladen (niet live).",
    };
  }

  return {
    sourceId: "rws-wadar",
    sourceLabel: rights.sourceLabel,
    status: "NOT_LINKED",
    rightsNote: rights.usageNote,
    coverageNote: "Meetpunt is niet representatief voor elk watergebied.",
    publishedAt: null,
    receivedAt: new Date().toISOString(),
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: null,
    message: "Waterdata niet gekoppeld. Geen veilige-waterclaim.",
  };
}
