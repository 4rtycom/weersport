import { buildAnalysisCacheKey } from "@/lib/billing/analysis";
import { pointInGeometry } from "@/lib/data/knmi/geometry";
import { matchKnmiWarnings } from "@/lib/data/knmi/ingest";
import { parseKnmiSnapshot } from "@/lib/data/knmi/parse";
import { knmiKeyConfigured } from "@/lib/data/knmi/key";
import { selectAirStation, airIsFresh, resetAirBudgetForTests } from "@/lib/data/luchtmeetnet/representativeness";
import type { AirStation } from "@/lib/data/luchtmeetnet/stations";
import { parseCentroide, validateNlPoint } from "@/lib/data/pdok/client";
import { dataFlagSnapshot } from "@/lib/data/flags";
import { safetyFromWarnings } from "@/lib/data/safety-gate";
import { parseRwsCatalog } from "@/lib/data/rws/catalog";
import { matchWaterLocation } from "@/lib/data/rws/spot-mapping";
import { interpretRwsQuality } from "@/lib/data/rws/quality";
import { resetDataStoreForTests, writeKnmiStore } from "@/lib/data/storage/memory";
import { selectWoonplaats, toPlace, searchPlaces } from "@/lib/places";
import { parseSportTimestamp } from "@/lib/data/time";
import { scoreSportHours } from "@/lib/scoring/engine";
import type { SearchDraft } from "@/lib/draft";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const flags = dataFlagSnapshot();
assert(Object.values(flags).every((enabled) => enabled === false), "flags must default off");

assert(parseSportTimestamp("2026-07-01T12:00").toISOString() === "2026-07-01T10:00:00.000Z", "summer time");
assert(parseSportTimestamp("2026-01-01T12:00").toISOString() === "2026-01-01T11:00:00.000Z", "winter time");

function hour(offset: number, uvIndex: number | null) {
  return {
    time: new Date(Date.now() + offset * 60 * 60 * 1000).toISOString(),
    temperatureC: 16,
    windKmh: 12,
    precipitationProbability: 10,
    uvIndex,
  };
}

const hours = [hour(-3, 1), ...Array.from({ length: 48 }, (_, index) => hour(index, index === 2 ? null : 3)), hour(49, 2)];
const scored = scoreSportHours({ sportId: "wandelen", hours, waterLinked: true });
assert(scored.kind === "SCORED", "land sport scores");
if (scored.kind === "SCORED") {
  assert(scored.hourly.length === 48, `expected 48 hours, got ${scored.hourly.length}`);
  assert(scored.hourly.some((point) => point.uvIndex === null), "missing UV stays null");
  assert(scored.hourly.every((point) => point.uvIndex !== 0), "missing UV is not filled with 0");
}

const waterBlocked = scoreSportHours({
  sportId: "zeilen",
  hours,
  waterLinked: true,
  hasAcceptedWaterMeasurement: false,
});
assert(waterBlocked.kind === "NO_SCORE", "water link is not an approval");
const waterScored = scoreSportHours({ sportId: "zeilen", hours, hasAcceptedWaterMeasurement: true });
assert(waterScored.kind === "SCORED", "accepted water measurement can score comfort");
const swim = scoreSportHours({ sportId: "openwaterzwemmen", hours, hasAcceptedWaterMeasurement: true, swimLinked: true });
assert(swim.kind === "NO_SCORE", "swim stays NO_SCORE");
const ice = scoreSportHours({ sportId: "schaatsen", hours, hasAcceptedWaterMeasurement: true });
assert(ice.kind === "NO_SCORE" && ice.reason.toLowerCase().includes("natuurijs"), "ice stays NO_SCORE");

const ring = {
  type: "Polygon" as const,
  coordinates: [[[4.7, 52.1], [5.1, 52.1], [5.1, 52.5], [4.7, 52.5], [4.7, 52.1]] as [number, number][]],
};
assert(pointInGeometry(4.9, 52.3, ring), "inside polygon");
assert(!pointInGeometry(6.2, 53.1, ring), "outside polygon");
assert(pointInGeometry(4.7, 52.3, ring), "boundary counts as inside");

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const tomorrowEnd = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();
const warning = {
  metadata: {
    schema_version: "1.0.0",
    publication_type: "manual",
    generated_at: new Date().toISOString(),
    snapshot_uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  },
  num_warning_sets: 1,
  num_warnings: 2,
  warnings: [
    {
      phenomenon: "wind",
      operational_status: "Actual",
      warning_set_uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      texts: { nl: { headline: "Wind", description: "Zware windstoten." }, en: { headline: "Wind", description: "Wind." } },
      parts: [
        {
          part_uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          status: "cancelled",
          color: "red",
          onset: tomorrow,
          expires: tomorrowEnd,
          area: ring,
        },
        {
          part_uuid: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          status: "active",
          color: "yellow",
          onset: tomorrow,
          expires: tomorrowEnd,
          area: ring,
        },
      ],
    },
  ],
};
const parsed = parseKnmiSnapshot(warning);
assert(parsed.ok && parsed.snapshot.parts.length === 1 && parsed.snapshot.parts[0].color === "geel", "cancelled part dropped");
const empty = parseKnmiSnapshot({
  metadata: { schema_version: "1.0.0", publication_type: "heartbeat", generated_at: new Date().toISOString(), snapshot_uuid: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" },
  num_warning_sets: 0,
  num_warnings: 0,
  warnings: [],
});
assert(empty.ok && empty.snapshot.emptyOperational, "empty heartbeat is valid");
const testPublication = parseKnmiSnapshot({
  metadata: { schema_version: "1.0.0", publication_type: "test", generated_at: new Date().toISOString(), snapshot_uuid: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
  num_warning_sets: 0,
  num_warnings: 0,
  warnings: [],
});
assert(testPublication.ok && testPublication.snapshot.rejectedAsTest, "test publication is rejected");

process.env.DATA_KNMI_ENABLED = "true";
if (parsed.ok) {
  writeKnmiStore({ hash: "abc", filename: "public_warnings_test.json", fetchedAt: new Date().toISOString(), snapshot: parsed.snapshot });
  const inside = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  const outside = matchKnmiWarnings({ latitude: 53.1, longitude: 6.2, from: new Date(), until: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  assert(inside.items.length === 1, "warning shown for tomorrow inside the polygon");
  assert(outside.items.length === 0 && outside.status === "READY", "neighbouring place has no warning");
  assert(!inside.message.toLowerCase().includes("geen waarschuwingen"), "do not use a blanket no-warning phrase");
}
delete process.env.DATA_KNMI_ENABLED;
resetDataStoreForTests();
const unlinked = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date() });
assert(unlinked.status === "NOT_LINKED", "flag off stays NOT_LINKED");
assert(safetyFromWarnings(unlinked).level === "UNKNOWN", "missing feed is unknown");
const savedKnmiKey = process.env.KNMI_API_KEY;
process.env.KNMI_API_KEY = "eyJ";
assert(knmiKeyConfigured() === false, "prefix is not a usable key");
if (savedKnmiKey === undefined) delete process.env.KNMI_API_KEY;
else process.env.KNMI_API_KEY = savedKnmiKey;

const catalog = parseRwsCatalog({
  Succesvol: true,
  AquoMetadataLijst: [
    { AquoMetadata_MessageID: 1, Compartiment: { Code: "OW" }, Grootheid: { Code: "T" }, Parameter_Wat_Omschrijving: "Temperatuur in Oppervlaktewater in oC" },
    { AquoMetadata_MessageID: 2, Compartiment: { Code: "OW" }, Grootheid: { Code: "WATHTE" }, Parameter_Wat_Omschrijving: "Waterhoogte astronomisch in Oppervlaktewater t.o.v. Mean Sea Level in cm" },
  ],
  AquoMetadataLocatieLijst: [
    { AquoMetaData_MessageID: 1, Locatie_MessageID: 10 },
    { AquoMetaData_MessageID: 2, Locatie_MessageID: 11 },
  ],
  LocatieLijst: [
    { Locatie_MessageID: 10, Code: "ijmuiden.buitenhaven", Naam: "IJmuiden buitenhaven", Omschrijving: "IJmuiden", Lat: 52.46, Lon: 4.55 },
    { Locatie_MessageID: 11, Code: "loosdrecht", Naam: "Loosdrecht", Omschrijving: "Loosdrechtse plassen", Lat: 52.2, Lon: 5.08 },
  ],
});
assert(catalog && catalog.length === 2, "catalog parsed");
const noSpot = matchWaterLocation({ spot: null, locations: catalog ?? [], quantityCode: "T" });
assert(noSpot.coverage === "NONE", "city centroid is not a water match");
const wrongWater = matchWaterLocation({
  spot: { id: "spot-1", name: "Loosdrechtse plassen", kind: "lake", latitude: 52.463, longitude: 4.555 },
  locations: catalog ?? [],
  quantityCode: "T",
});
assert(wrongWater.coverage === "NONE", "nearest station on another water is rejected");
const exact = matchWaterLocation({
  spot: { id: "spot-2", name: "IJmuiden", kind: "coast", latitude: 52.46, longitude: 4.55, rwsLocationCode: "ijmuiden.buitenhaven" },
  locations: catalog ?? [],
  quantityCode: "T",
});
assert(exact.coverage === "EXACT", "explicit station matches");
const missingCurrent = matchWaterLocation({
  spot: { id: "spot-2", name: "IJmuiden", kind: "coast", latitude: 52.46, longitude: 4.55, rwsLocationCode: "ijmuiden.buitenhaven" },
  locations: catalog ?? [],
  quantityCode: "STROOMSHD",
});
assert(missingCurrent.coverage === "NONE", "current is not invented");
assert(interpretRwsQuality("99", 12).value === null, "gap code 99");
assert(interpretRwsQuality("00", 13).value === 13, "unchecked value kept");

const stations: AirStation[] = [
  { number: "FAR", label: "Ver", latitude: 53.2, longitude: 6.5, stationType: "Achtergrond", components: ["PM25", "PM10", "NO2", "O3"] },
  { number: "NEAR", label: "Dichtbij", latitude: 52.37, longitude: 4.9, stationType: "Achtergrond", components: ["PM10", "NO2"] },
];
assert(selectAirStation({ stations, latitude: 52.37, longitude: 4.89, formula: "PM25" }) === null, "no nearby PM25");
assert(airIsFresh(new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) === false, "three-hour-old air is not fresh");
resetAirBudgetForTests();

const point = parseCentroide("POINT(4.90454 52.37344)");
assert(point?.latitude === 52.37344 && point.longitude === 4.90454, "PDOK order is longitude latitude");
assert(validateNlPoint({ latitude: 4.9, longitude: 52.3 }) === false, "swapped coordinate rejected");
assert(validateNlPoint({ latitude: 48, longitude: 2 }) === false, "outside NL rejected");
const hengelo = selectWoonplaats(
  [
    { id: "wpl-1", label: "Hengelo", detail: "Hengelo, Hengelo, Overijssel" },
    { id: "wpl-2", label: "Hengelo", detail: "Hengelo, Bronckhorst, Gelderland" },
  ],
  "hengelo",
);
assert(hengelo?.id === "wpl-1", "ambiguous hometown preferred");
assert(selectWoonplaats(
  [
    { id: "wpl-3", label: "Bergen", detail: "Bergen, Alkmaar, Noord-Holland" },
    { id: "wpl-4", label: "Bergen", detail: "Bergen, Gennep, Limburg" },
  ],
  "bergen",
) === null, "ambiguous places without one hometown stay unresolved");
assert(toPlace({ id: "adr-1", type: "adres", weergavenaam: "Straat 1" }) === null, "non-woonplaats dropped");
assert((await searchPlaces("a")).length === 0, "short query does not search");

const draft: SearchDraft = { sportId: "wandelen", sportName: "Wandelen", placeId: "wpl-1", placeLabel: "Amsterdam", period: "Komende 48 uur" };
const key = buildAnalysisCacheKey("user", draft);
assert(!key.includes(":spot:"), "cache key unchanged without a spot");
assert(buildAnalysisCacheKey("user", { ...draft, sportSpot: { id: "spot", name: "Strand", kind: "beach", latitude: 52.3, longitude: 4.5 } }).includes(":spot:spot"), "spot changes only its own key");

if (process.env.KNMI_LIVE === "1") {
  process.env.DATA_KNMI_ENABLED = "true";
  const { ingestKnmiSnapshot } = await import("@/lib/data/knmi/ingest");
  const live = await ingestKnmiSnapshot();
  delete process.env.DATA_KNMI_ENABLED;
  if (!live.ok) {
    console.error(`KNMI live ingest failed: ${live.code} ${live.message}`);
    process.exit(1);
  }
  const stored = (await import("@/lib/data/storage/memory")).readKnmiStore();
  console.log(
    `KNMI live ok filename=${live.filename} records=${live.records} publication=${stored?.snapshot.publicationType ?? "none"} generatedAt=${stored?.snapshot.generatedAt ?? "none"}`,
  );
}

console.log("data integration checks ok");
