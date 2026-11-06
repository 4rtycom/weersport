import { SWIM_STALE_AFTER_MS, isStale } from "@/lib/data/contracts";
import { fixtureName, fixturesEnabled, loadFixtureJson } from "@/lib/data/fixtures";
import { rightsFor } from "@/lib/data/sources";
import type { SourceObservation, SwimBundle } from "@/lib/data/types";

type SwimFixture = {
  status: SourceObservation<SwimBundle>["status"];
  publishedAt: string | null;
  value: SwimBundle | null;
  siteLabel?: string;
};

/**
 * Zwemwater / BIJ12. Never improvises quality advice without a linked feed or fixture.
 */
export async function fetchZwemwater(placeLabel: string): Promise<SourceObservation<SwimBundle>> {
  const rights = rightsFor("zwemwater-bij12")!;
  if (fixturesEnabled()) {
    const name = fixtureName("WEERSPORT_SWIM_FIXTURE", "ready");
    const fixture = loadFixtureJson<SwimFixture>(`swim-${name}`);
    const stale = fixture.publishedAt ? isStale(fixture.publishedAt, SWIM_STALE_AFTER_MS) : false;
    return {
      sourceId: "zwemwater-bij12",
      sourceLabel: rights.sourceLabel,
      status: stale ? "STALE" : fixture.status,
      rightsNote: `${rights.usageNote} · TEST_ONLY fixture`,
      coverageNote: "Officiële zwemlocatie vereist; niet afleidbaar uit alleen een stadnaam.",
      publishedAt: fixture.publishedAt,
      receivedAt: new Date().toISOString(),
      validUntil: null,
      locationLabel: fixture.siteLabel ?? placeLabel,
      demo: true,
      value: fixture.value,
      message: stale ? "Fixture zwemwaterstatus is verouderd." : "Fixture zwemwaterstatus geladen (niet live).",
    };
  }

  return {
    sourceId: "zwemwater-bij12",
    sourceLabel: rights.sourceLabel,
    status: "NOT_LINKED",
    rightsNote: rights.usageNote,
    coverageNote: "Geen realtime claim zonder tijdige officiële data.",
    publishedAt: null,
    receivedAt: new Date().toISOString(),
    validUntil: null,
    locationLabel: placeLabel,
    demo: false,
    value: null,
    message: "Zwemwaterstatus niet gekoppeld.",
  };
}
