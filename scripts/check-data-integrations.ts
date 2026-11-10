import { buildAnalysisCacheKey } from "@/lib/billing/analysis";
import { pointInGeometry } from "@/lib/data/knmi/geometry";
import { matchKnmiWarnings, storeKnmiSnapshot } from "@/lib/data/knmi/ingest";
import { parseKnmiSnapshot } from "@/lib/data/knmi/parse";
import { knmiKeyConfigured } from "@/lib/data/knmi/key";
import { parseMeasurement } from "@/lib/data/luchtmeetnet/measurements";
import { selectAirStation, airIsFresh, resetAirBudgetForTests } from "@/lib/data/luchtmeetnet/representativeness";
import { providerRequest, resetProviderHttpForTests } from "@/lib/data/providers/http";
import type { AirStation } from "@/lib/data/luchtmeetnet/stations";
import { parseCentroide, validateNlPoint } from "@/lib/data/pdok/client";
import { dataFlagSnapshot } from "@/lib/data/flags";
import { safetyFromWarnings } from "@/lib/data/safety-gate";
import { parseRwsCatalog } from "@/lib/data/rws/catalog";
import { matchWaterLocation } from "@/lib/data/rws/spot-mapping";
import { interpretRwsQuality } from "@/lib/data/rws/quality";
import { readKnmiStore, resetDataStoreForTests, writeKnmiStore } from "@/lib/data/storage/memory";
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
assert(parseSportTimestamp("2026-03-29T01:30").toISOString() === "2026-03-29T00:30:00.000Z", "before spring forward");
assert(parseSportTimestamp("2026-03-29T03:30").toISOString() === "2026-03-29T01:30:00.000Z", "after spring forward");
assert(parseSportTimestamp("2026-10-25T01:30").toISOString() === "2026-10-24T23:30:00.000Z", "before autumn fallback");
assert(parseSportTimestamp("2026-10-25T03:30").toISOString() === "2026-10-25T02:30:00.000Z", "after autumn fallback");

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
const exercise = parseKnmiSnapshot({
  metadata: { schema_version: "1.0.0", publication_type: "manual", generated_at: new Date().toISOString(), snapshot_uuid: "12121212-1212-1212-1212-121212121212" },
  num_warning_sets: 1,
  num_warnings: 1,
  warnings: [
    {
      phenomenon: "wind",
      operational_status: "Exercise",
      warning_set_uuid: "13131313-1313-1313-1313-131313131313",
      texts: { nl: { headline: "Oefening", description: "Geen echte waarschuwing." } },
      parts: [
        {
          part_uuid: "14141414-1414-1414-1414-141414141414",
          status: "active",
          color: "red",
          onset: tomorrow,
          expires: tomorrowEnd,
          area: ring,
        },
      ],
    },
  ],
});
assert(exercise.ok && exercise.snapshot.rejectedAsTest && exercise.snapshot.parts.length === 0, "exercise is not operational");
if (empty.ok) {
  writeKnmiStore({ hash: "empty", filename: "public_warnings_empty.json", fetchedAt: new Date().toISOString(), snapshot: empty.snapshot });
  const clear = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  assert(clear.status === "READY", "fresh empty snapshot is ready");
  assert(clear.message.includes("geen KNMI-waarschuwing in gecontroleerd venster"), "empty window names the checked window");
  assert(clear.message.includes(empty.snapshot.generatedAt), "empty window names the publication time");
  assert(clear.message.includes("KNMI"), "empty window names the source");
  assert(safetyFromWarnings(clear).level === "NONE_IN_WINDOW", "fresh empty snapshot is an explicit clear window");
}
if (parsed.ok) {
  const staleSnapshot = {
    ...parsed.snapshot,
    generatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
  };
  writeKnmiStore({ hash: "stale", filename: "public_warnings_stale.json", fetchedAt: new Date().toISOString(), snapshot: staleSnapshot });
  const stale = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  assert(stale.status === "STALE", "old snapshot is stale");
  assert(!stale.message.toLowerCase().includes("geen waarschuwing"), "stale snapshot does not claim there is no warning");
  assert(safetyFromWarnings(stale).level === "UNKNOWN", "stale snapshot is unknown");
}
if (exercise.ok && parsed.ok) {
  storeKnmiSnapshot("public_warnings_live.json", "live-operational", parsed.snapshot);
  const liveBeforeExercise = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  assert(liveBeforeExercise.status === "OFFICIAL_WARNING" && liveBeforeExercise.items.length === 1, "operational snapshot is live before the exercise");
  storeKnmiSnapshot("public_warnings_exercise_later.json", "later-exercise", exercise.snapshot);
  const drilled = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  assert(drilled.status === "NOT_LINKED" && drilled.items.length === 0, "later exercise does not keep the previous warning live");
  assert(!drilled.message.toLowerCase().includes("geen waarschuwing"), "exercise does not claim there is no warning");
  assert(safetyFromWarnings(drilled).level === "UNKNOWN", "exercise is unknown");
  assert(readKnmiStore()?.snapshot.rejectedAsTest === true, "stored snapshot is the exercise, not the old operational file");
}
if (testPublication.ok) {
  writeKnmiStore({ hash: "testpub", filename: "public_warnings_testpub.json", fetchedAt: new Date().toISOString(), snapshot: testPublication.snapshot });
  const tested = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date(Date.now() + 48 * 60 * 60 * 1000) });
  assert(tested.status === "NOT_LINKED", "test publication is not shown as live");
  assert(safetyFromWarnings(tested).level === "UNKNOWN", "test publication is unknown");
}
delete process.env.DATA_KNMI_ENABLED;
resetDataStoreForTests();
const unlinked = matchKnmiWarnings({ latitude: 52.3, longitude: 4.9, from: new Date(), until: new Date() });
assert(unlinked.status === "NOT_LINKED", "flag off stays NOT_LINKED");
assert(safetyFromWarnings(unlinked).level === "UNKNOWN", "missing feed is unknown");
assert(!unlinked.message.toLowerCase().includes("geen waarschuwing"), "unlinked feed does not claim there is no warning");
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

function amsterdamWall(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
const wall = amsterdamWall(new Date(Date.now() + 2 * 60 * 60 * 1000));
const clock = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
}).format(parseSportTimestamp(wall));
const shifted = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
}).format(new Date(wall));
const labeled = scoreSportHours({
  sportId: "wandelen",
  hours: [{ time: wall, temperatureC: 16, windKmh: 12, precipitationProbability: 5, uvIndex: null }],
});
assert(labeled.kind === "SCORED", "offset-less hour scores");
if (labeled.kind === "SCORED") {
  assert(clock !== shifted, "UTC host must shift a naive timestamp");
  assert(labeled.bestTimeLabel.includes(clock), `best time should use Amsterdam clock ${clock}`);
  assert(labeled.peakWindow.label.includes(clock), "peak window should use Amsterdam clock");
  assert(!labeled.bestTimeLabel.includes(shifted), "best time must not use the UTC reading");
}

const latestAir = parseMeasurement(
  {
    data: [
      { formula: "PM25", value: 10, timestamp_measured: "2026-11-10T05:00:00+00:00" },
      { formula: "PM10", value: 99, timestamp_measured: "2026-11-10T09:00:00+00:00" },
      { formula: "PM25", value: 22, timestamp_measured: "2026-11-10T08:00:00+00:00" },
      { formula: "PM25", value: 15, timestamp_measured: "2026-11-10T07:00:00+00:00" },
    ],
  },
  "PM25",
);
assert(latestAir.value === 22 && latestAir.observedAt === "2026-11-10T08:00:00+00:00", "air reading uses the latest timestamp");

const hole: [number, number][] = [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]];
const outer: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
const donut = { type: "Polygon" as const, coordinates: [outer, hole] };
assert(pointInGeometry(0.5, 0.5, donut), "point between outer ring and hole matches");
assert(!pointInGeometry(2, 2, donut), "point inside a hole does not match");
const multi = {
  type: "MultiPolygon" as const,
  coordinates: [
    [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]] as [number, number][]],
    [outer, hole],
  ],
};
assert(!pointInGeometry(2, 2, multi), "hole in a multipolygon does not match");

const originalFetch = globalThis.fetch;
const upstream = { calls: 0 };
const sent = () => upstream.calls;
globalThis.fetch = async () => {
  upstream.calls += 1;
  return new Response("unavailable", { status: 500 });
};
resetProviderHttpForTests();
const firstFailure = await providerRequest({ provider: "knmi", url: "https://example.test/warnings", retries: 2, timeoutMs: 1000 });
if (firstFailure.ok || firstFailure.code !== "UPSTREAM") throw new Error("upstream failure is reported");
if (sent() !== 3) throw new Error(`retries stay inside one call, saw ${sent()}`);
const secondFailure = await providerRequest({ provider: "knmi", url: "https://example.test/warnings", retries: 2, timeoutMs: 1000 });
if (secondFailure.ok || secondFailure.code === "CIRCUIT_OPEN") throw new Error("one exhausted call does not open the circuit");
await providerRequest({ provider: "knmi", url: "https://example.test/warnings", retries: 2, timeoutMs: 1000 });
const blocked = await providerRequest({ provider: "knmi", url: "https://example.test/warnings", retries: 2, timeoutMs: 1000 });
if (blocked.ok || blocked.code !== "CIRCUIT_OPEN") throw new Error("circuit opens after three failed calls");
if (sent() !== 9) throw new Error(`the open circuit does not send another request, saw ${sent()}`);
globalThis.fetch = originalFetch;
resetProviderHttpForTests();

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
