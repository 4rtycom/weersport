import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decideAdPlacement } from "@/lib/ads/policy";
import { analysisCacheIdentity, quotaBlocksSnapshot, snapshotConsumesQuota, snapshotIsCurrent } from "@/lib/billing/analysis";
import type { ForecastSnapshot, SourceObservation, WaterBundle, WeatherBundle, WeatherHour } from "@/lib/data/types";
import { parseDraft } from "@/lib/draft";
import { createPlannedMoment } from "@/lib/moments/store";
import { scoreSportHours } from "@/lib/scoring/engine";
import { FIXTURE_LABEL, FIXTURE_MODEL_VERSION, scoreFixtureWindow } from "@/lib/scoring/fixture-window";
import { getScoreProfile, sportProfiles } from "@/lib/scoring/profiles";
import {
  MISSING_WATER_TEMPERATURE_REASON,
  NO_VALIDATED_SWIM_RULE_REASON,
  assessOpenWater,
  type SwimReading,
} from "@/lib/scoring/swim";
import { HOUR_MS, formatClock, horizonFor, selectUsableHours } from "@/lib/scoring/windows";
import { sports } from "@/lib/sports";

const NOW = new Date("2026-06-15T08:00:00.000Z");
const SPOT = "spot-a";
const PLACE = "wpl-amsterdam";

function weather(start: Date, count: number, patch?: Partial<WeatherHour>): WeatherHour[] {
  return Array.from({ length: count }, (_, index) => ({
    time: new Date(start.getTime() + index * HOUR_MS).toISOString(),
    temperatureC: 18,
    windKmh: 12,
    precipitationProbability: 10,
    uvIndex: 3,
    ...patch,
  }));
}

function reading(partial: Partial<SwimReading> & Pick<SwimReading, "id">): SwimReading {
  return {
    value: null,
    unit: null,
    quality: "measured",
    locationId: SPOT,
    observedAt: "2026-06-15T07:00:00.000Z",
    validUntil: "2026-06-15T12:00:00.000Z",
    sourceId: "fixture-source",
    sourceLabel: "Gelabelde fixturebron",
    applicabilityNote: null,
    ...partial,
  };
}

function notApplicable(id: SwimReading["id"], note: string): SwimReading {
  return reading({ id, quality: "not_applicable", value: null, unit: null, applicabilityNote: note });
}

function stillBase(temp: number): SwimReading[] {
  return [
    reading({ id: "swimStatus", value: "open", unit: null }),
    reading({ id: "waterTemperature", value: temp, unit: "celsius" }),
    notApplicable("current", "Stilstaand water zonder doorstroming op deze officiële zwemplek."),
    notApplicable("currentDirection", "Zonder stroming is er geen stroomrichting."),
    notApplicable("waves", "Geen golfslagmeting van toepassing op deze beschutte plas."),
    notApplicable("exposure", "Blootstelling is niet van toepassing op deze beschutte plas."),
  ];
}

function assessStill(temp: number | null) {
  const readings = stillBase(temp ?? 0).filter((item) => temp !== null || item.id !== "waterTemperature");
  return assessOpenWater({
    placeId: PLACE,
    spotId: SPOT,
    spotClass: "official",
    waterKind: "stilstaand",
    coverage: "ok",
    readings,
    now: NOW,
  });
}

assert.equal(sports.length, 24);
for (const sport of sports) {
  const profile = getScoreProfile(sport.id);
  assert.equal(profile.sportId, sport.id);
  assert.equal(profile.personalAdvice, false);
  assert.equal(profile.releaseStatus, "withheld");
  assert.match(profile.modelVersion, /v1/);
  assert.ok(profile.requiredFields.length > 0);
  assert.ok(profile.blocks.some((block) => block.applied));
  if (sport.id === "openwaterzwemmen") assert.equal(profile.gate, null);
  else assert.ok(profile.gate);
}
assert.equal(Object.keys(sportProfiles).length, 24);

const airA = weather(NOW, 48, { temperatureC: 14, windKmh: 8, precipitationProbability: 5 });
const airB = weather(NOW, 48, { temperatureC: 27, windKmh: 8, precipitationProbability: 5 });
const cool = scoreSportHours({
  sportId: "openwaterzwemmen",
  hours: airA,
  now: NOW,
  placeId: PLACE,
  spotId: SPOT,
  swim: {
    placeId: PLACE,
    spotId: SPOT,
    spotClass: "official",
    waterKind: "stilstaand",
    coverage: "ok",
    readings: stillBase(14),
    now: NOW,
  },
});
const warm = scoreSportHours({
  sportId: "openwaterzwemmen",
  hours: airB,
  now: NOW,
  placeId: PLACE,
  spotId: SPOT,
  swim: {
    placeId: PLACE,
    spotId: SPOT,
    spotClass: "official",
    waterKind: "stilstaand",
    coverage: "ok",
    readings: stillBase(22),
    now: NOW,
  },
});
assert.equal(cool.kind, "NO_SCORE");
assert.equal(warm.kind, "NO_SCORE");
if (cool.kind !== "NO_SCORE" || warm.kind !== "NO_SCORE") throw new Error("expected no score");
assert.equal(cool.reason, NO_VALIDATED_SWIM_RULE_REASON);
assert.equal(warm.reason, NO_VALIDATED_SWIM_RULE_REASON);
assert.equal(cool.blocked, false);
assert.notEqual(
  cool.measurements?.find((item) => item.id === "waterTemperature")?.display,
  warm.measurements?.find((item) => item.id === "waterTemperature")?.display,
);
assert.equal(cool.measurements?.find((item) => item.id === "waterTemperature")?.display, "14 °C");
assert.equal(warm.measurements?.find((item) => item.id === "waterTemperature")?.display, "22 °C");
assert.equal(JSON.stringify(cool).includes("peakWindow"), false);

const missingTemp = assessStill(null);
assert.equal(missingTemp.reason, MISSING_WATER_TEMPERATURE_REASON);
assert.equal(missingTemp.blocked, true);
assert.notEqual(missingTemp.reason, cool.reason);

const flowingMeasured = assessOpenWater({
  placeId: PLACE,
  spotId: SPOT,
  spotClass: "official",
  waterKind: "stromend",
  coverage: "ok",
  now: NOW,
  readings: [
    reading({ id: "swimStatus", value: "open", unit: null }),
    reading({ id: "waterTemperature", value: 16, unit: "celsius" }),
    reading({ id: "current", value: 0.2, unit: "m/s" }),
    reading({ id: "currentDirection", value: 90, unit: "deg" }),
    notApplicable("waves", "Golfslag is hier niet als aparte meting van toepassing."),
    notApplicable("exposure", "Blootstelling is hier niet als aparte meting van toepassing."),
  ],
});
const flowingTideOnly = assessOpenWater({
  placeId: PLACE,
  spotId: SPOT,
  spotClass: "official",
  waterKind: "stromend",
  coverage: "ok",
  now: NOW,
  readings: [
    reading({ id: "swimStatus", value: "open", unit: null }),
    reading({ id: "waterTemperature", value: 16, unit: "celsius" }),
    reading({ id: "tideTime", value: "2026-06-15T09:30:00.000Z", unit: null }),
    notApplicable("waves", "Golfslag is hier niet als aparte meting van toepassing."),
    notApplicable("exposure", "Blootstelling is hier niet als aparte meting van toepassing."),
  ],
});
assert.equal(flowingMeasured.reason, NO_VALIDATED_SWIM_RULE_REASON);
assert.equal(flowingMeasured.measurements.find((item) => item.id === "current")?.display, "0.2 m/s");
assert.match(flowingTideOnly.reason, /getijdentijdstip is geen meting/i);
assert.notEqual(flowingMeasured.reason, flowingTideOnly.reason);

const stillJustified = assessStill(18);
assert.equal(stillJustified.blocked, false);
assert.equal(
  stillJustified.measurements.find((item) => item.id === "current")?.quality,
  "not_applicable",
);
const stillUnjustified = assessOpenWater({
  placeId: PLACE,
  spotId: SPOT,
  spotClass: "official",
  waterKind: "stilstaand",
  coverage: "ok",
  now: NOW,
  readings: stillBase(18).filter((item) => item.id !== "current"),
});
assert.equal(stillUnjustified.blocked, true);
assert.match(stillUnjustified.reason, /stilstaand water/i);

const expired = assessOpenWater({
  placeId: PLACE,
  spotId: SPOT,
  spotClass: "official",
  waterKind: "stilstaand",
  coverage: "ok",
  now: NOW,
  readings: stillBase(18).map((item) =>
    item.id === "waterTemperature" ? { ...item, validUntil: "2026-06-15T07:00:00.000Z" } : item,
  ),
});
assert.match(expired.reason, /verlopen/i);

const otherStation = assessOpenWater({
  placeId: PLACE,
  spotId: SPOT,
  spotClass: "official",
  waterKind: "stilstaand",
  coverage: "ok",
  now: NOW,
  readings: stillBase(18).map((item) => (item.id === "waterTemperature" ? { ...item, locationId: "spot-b" } : item)),
});
assert.match(otherStation.reason, /ander meetpunt/i);

const thinCoverage = assessOpenWater({
  placeId: PLACE,
  spotId: SPOT,
  spotClass: "official",
  waterKind: "stilstaand",
  coverage: "insufficient",
  now: NOW,
  readings: stillBase(18),
});
assert.match(thinCoverage.reason, /dekking/i);

const banned = assessOpenWater({
  placeId: PLACE,
  spotId: SPOT,
  spotClass: "official",
  waterKind: "stilstaand",
  coverage: "ok",
  now: NOW,
  readings: stillBase(18).map((item) => (item.id === "swimStatus" ? { ...item, value: "negatief zwemadvies" } : item)),
});
assert.equal(banned.blocked, true);
assert.match(banned.reason, /zwemverbod|negatief zwemadvies/i);
assert.equal(JSON.stringify(banned).includes("peakWindow"), false);

const coast = assessOpenWater({
  placeId: PLACE,
  spotId: null,
  spotClass: "coast-not-swim",
  waterKind: "kust",
  coverage: "ok",
  now: NOW,
  readings: [],
});
assert.match(coast.reason, /kustlocatie/i);

const unlinked = scoreSportHours({
  sportId: "openwaterzwemmen",
  hours: airA,
  now: NOW,
  placeId: PLACE,
  spotId: null,
});
assert.equal(unlinked.kind, "NO_SCORE");
if (unlinked.kind === "NO_SCORE") {
  assert.match(unlinked.reason, /officiële zwemplek/i);
  assert.equal(unlinked.missing?.includes("watertemperatuur"), true);
}

for (const sportId of ["fietsen", "wielrennen", "hardlopen", "zeilen", "schaatsen"]) {
  const result = scoreSportHours({ sportId, hours: airA, now: NOW });
  assert.equal(result.kind, "NO_SCORE");
  if (result.kind !== "NO_SCORE") continue;
  assert.equal(result.modelVersion, getScoreProfile(sportId).modelVersion);
  assert.equal(JSON.stringify(result).includes("peakWindow"), false);
  assert.equal(snapshotConsumesQuota(fakeSnapshot(result, sportId)), false);
}
const ice = scoreSportHours({ sportId: "schaatsen", hours: airA, now: NOW });
if (ice.kind === "NO_SCORE") assert.match(ice.reason, /Natuurijs/);

function fakeSnapshot(suitability: ForecastSnapshot["suitability"], sportId: string): ForecastSnapshot {
  return {
    sportId,
    sportName: sportId,
    placeId: PLACE,
    placeLabel: "Amsterdam",
    period: "Komende 48 uur",
    spotId: null,
    generatedAt: NOW.toISOString(),
    weather: {
      sourceId: "open-meteo",
      sourceLabel: "Open-Meteo",
      status: "READY",
      rightsNote: "test",
      coverageNote: "test",
      publishedAt: NOW.toISOString(),
      receivedAt: NOW.toISOString(),
      validUntil: null,
      locationLabel: "Amsterdam",
      demo: false,
      value: { temperatureC: 18, windKmh: 12, precipitationProbability: 10, hours: airA },
      message: "test",
    },
    uv: {
      sourceId: "uv",
      sourceLabel: "UV",
      status: "READY",
      rightsNote: "test",
      coverageNote: "test",
      publishedAt: null,
      receivedAt: NOW.toISOString(),
      validUntil: null,
      locationLabel: null,
      demo: false,
      value: { index: 3, level: "matig", label: "Matig" },
      message: "test",
    },
    warnings: {
      sourceId: "knmi",
      sourceLabel: "KNMI",
      status: "NOT_LINKED",
      rightsNote: "test",
      coverageNote: "test",
      publishedAt: null,
      receivedAt: NOW.toISOString(),
      validUntil: null,
      locationLabel: null,
      demo: false,
      value: { items: [] },
      message: "niet gekoppeld",
    },
    water: {
      sourceId: "rws",
      sourceLabel: "RWS",
      status: "NOT_LINKED",
      rightsNote: "test",
      coverageNote: "test",
      publishedAt: null,
      receivedAt: NOW.toISOString(),
      validUntil: null,
      locationLabel: null,
      demo: false,
      value: null,
      message: "niet gekoppeld",
    },
    swim: {
      sourceId: "zwemwater",
      sourceLabel: "Zwemwater",
      status: "NOT_LINKED",
      rightsNote: "test",
      coverageNote: "test",
      publishedAt: null,
      receivedAt: NOW.toISOString(),
      validUntil: null,
      locationLabel: null,
      demo: false,
      value: null,
      message: "niet gekoppeld",
    },
    suitability,
    sources: [],
  };
}

const STATION = "station-fixture";

function observation<T>(value: T | null, patch?: Partial<SourceObservation<T>>): SourceObservation<T> {
  return {
    sourceId: "fixture-source",
    sourceLabel: "Gelabelde fixturebron",
    status: value === null ? "NOT_LINKED" : "READY",
    rightsNote: "Alleen voor deze test.",
    coverageNote: "Gelabelde fixture.",
    publishedAt: "2026-06-15T07:00:00.000Z",
    receivedAt: "2026-06-15T07:05:00.000Z",
    validUntil: "2026-06-15T12:00:00.000Z",
    locationLabel: "Fixture",
    demo: true,
    value,
    message: "fixture",
    ...patch,
  };
}

function waterBundle(partial: Partial<WaterBundle> = {}): WaterBundle {
  return {
    waterTemperatureC: null,
    waveHeightM: null,
    currentMs: null,
    currentDirectionDeg: null,
    waterKind: null,
    exposure: null,
    tideTime: null,
    stationId: STATION,
    ...partial,
  };
}

function samplePair(field: "waterTemperatureC" | "waveHeightM" | "currentMs" | "currentDirectionDeg"): [number, number] {
  if (field === "waterTemperatureC") return [14, 22];
  if (field === "currentMs") return [0.2, 0.8];
  if (field === "currentDirectionDeg") return [40, 220];
  return [0.4, 1.6];
}

function invalidSample(field: "waterTemperatureC" | "waveHeightM" | "currentMs" | "currentDirectionDeg") {
  if (field === "waterTemperatureC") return 80;
  if (field === "currentDirectionDeg") return 360;
  return -1;
}

const calmHours = weather(NOW, 48, { temperatureC: -2, windKmh: 8, precipitationProbability: 5, uvIndex: 1 });
const harshHours = weather(NOW, 48, { temperatureC: 31, windKmh: 45, precipitationProbability: 90, uvIndex: 8 });
const calmWeather: SourceObservation<WeatherBundle> = observation({
  temperatureC: -2,
  windKmh: 8,
  precipitationProbability: 5,
  hours: calmHours,
});
const harshWeather: SourceObservation<WeatherBundle> = observation({
  temperatureC: 31,
  windKmh: 45,
  precipitationProbability: 90,
  hours: harshHours,
});

for (const sport of sports) {
  const profile = getScoreProfile(sport.id);
  if (sport.id === "openwaterzwemmen") {
    assert.equal(profile.requiredFields.some((field) => field.id === "waterTemperature" && field.measurable), true);
    assert.notEqual(cool.reason, missingTemp.reason);
    assert.equal(snapshotConsumesQuota(fakeSnapshot(cool, sport.id)), false);
    continue;
  }
  const gate = profile.gate;
  if (!gate) throw new Error(`${sport.id} mist een poort`);
  const distracted = {
    weather: harshWeather,
    warnings: observation({ items: [{ title: "Onweer", detail: "Gelabelde fixture, geen bliksemcode." }] }),
    swim: observation({ advice: "zwemverbod", quality: "negatief", spotId: SPOT, spotLabel: "Fixture" }),
    linkedStationId: null as string | null,
  };
  if (gate.kind === "unmeasured") {
    const blocked = scoreSportHours({
      sportId: sport.id,
      hours: calmHours,
      now: NOW,
      placeId: PLACE,
      sources: { weather: calmWeather, linkedStationId: null },
    });
    const stillBlocked = scoreSportHours({
      sportId: sport.id,
      hours: harshHours,
      now: NOW,
      placeId: PLACE,
      sources: distracted,
    });
    assert.equal(blocked.kind, "NO_SCORE");
    assert.equal(stillBlocked.kind, "NO_SCORE");
    if (blocked.kind !== "NO_SCORE" || stillBlocked.kind !== "NO_SCORE") throw new Error(sport.id);
    assert.equal(blocked.reason, gate.blockedReason);
    assert.equal(stillBlocked.reason, gate.blockedReason);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.measurements?.length ?? 0, 0);
    assert.equal(JSON.stringify(blocked).includes("peakWindow"), false);
    assert.equal(blocked.horizon?.requestedHours, 48);
    assert.equal(snapshotConsumesQuota(fakeSnapshot(blocked, sport.id)), false);
    assert.equal(snapshotConsumesQuota(fakeSnapshot(stillBlocked, sport.id)), false);
    if (sport.id === "kitesurfen") {
      assert.equal(profile.requiredFields.find((item) => item.field === "tideTime")?.required, false);
      assert.equal(blocked.missing?.includes("getij"), false);
      assert.equal(stillBlocked.missing?.includes("getij"), false);
      assert.equal(blocked.missing?.includes("windrichting"), true);
      assert.equal(blocked.missing?.includes("lanceerzijde"), true);
    }
    if (gate.tideReason) {
      const tide = scoreSportHours({
        sportId: sport.id,
        hours: calmHours,
        now: NOW,
        placeId: PLACE,
        sources: {
          water: observation(waterBundle({ tideTime: "2026-06-15T09:30:00.000Z" })),
          linkedStationId: STATION,
        },
      });
      assert.equal(tide.kind, "NO_SCORE");
      if (tide.kind !== "NO_SCORE") throw new Error(sport.id);
      assert.equal(tide.reason, gate.tideReason);
      assert.notEqual(tide.reason, blocked.reason);
      assert.equal(tide.blocked, true);
      assert.equal(snapshotConsumesQuota(fakeSnapshot(tide, sport.id)), false);
      if (sport.id === "kitesurfen" && tide.kind === "NO_SCORE") {
        assert.equal(tide.missing?.includes("windrichting"), true);
        assert.equal(tide.missing?.includes("lanceerzijde"), true);
      }
    }
    continue;
  }

  const [low, high] = samplePair(gate.field);
  const absent = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    placeId: PLACE,
    sources: { weather: calmWeather, water: observation<WaterBundle>(null), linkedStationId: STATION },
  });
  const present = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    placeId: PLACE,
    sources: {
      ...distracted,
      water: observation(waterBundle({ [gate.field]: low })),
      linkedStationId: STATION,
    },
  });
  const sameWater = scoreSportHours({
    sportId: sport.id,
    hours: harshHours,
    now: NOW,
    placeId: PLACE,
    sources: {
      weather: harshWeather,
      water: observation(waterBundle({ [gate.field]: low })),
      linkedStationId: STATION,
    },
  });
  const otherValue = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    placeId: PLACE,
    sources: {
      water: observation(waterBundle({ [gate.field]: high })),
      linkedStationId: STATION,
    },
  });
  assert.equal(absent.kind, "NO_SCORE");
  assert.equal(present.kind, "NO_SCORE");
  assert.equal(sameWater.kind, "NO_SCORE");
  assert.equal(otherValue.kind, "NO_SCORE");
  if (absent.kind !== "NO_SCORE" || present.kind !== "NO_SCORE" || sameWater.kind !== "NO_SCORE" || otherValue.kind !== "NO_SCORE") {
    throw new Error(sport.id);
  }
  assert.equal(absent.reason, gate.blockedReason);
  assert.equal(present.reason, gate.recordedReason);
  assert.notEqual(absent.reason, present.reason);
  assert.equal(sameWater.reason, present.reason);
  assert.equal(otherValue.reason, present.reason);
  assert.equal(present.blocked, true);
  assert.equal(JSON.stringify(present).includes("peakWindow"), false);
  const lowDisplay = present.measurements?.find((item) => item.id === gate.field)?.display;
  const sameDisplay = sameWater.measurements?.find((item) => item.id === gate.field)?.display;
  const highDisplay = otherValue.measurements?.find((item) => item.id === gate.field)?.display;
  assert.ok(lowDisplay);
  assert.equal(lowDisplay, sameDisplay);
  assert.notEqual(lowDisplay, highDisplay);
  assert.equal(present.horizon?.requestedHours, 48);
  assert.equal(snapshotConsumesQuota(fakeSnapshot(absent, sport.id)), false);
  assert.equal(snapshotConsumesQuota(fakeSnapshot(present, sport.id)), false);

  const otherStation = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    sources: {
      water: observation(waterBundle({ [gate.field]: low, stationId: "ander-meetpunt" })),
      linkedStationId: STATION,
    },
  });
  assert.equal(otherStation.kind, "NO_SCORE");
  if (otherStation.kind === "NO_SCORE") assert.match(otherStation.reason, /ander meetpunt/);

  const expired = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    sources: {
      water: observation(waterBundle({ [gate.field]: low }), { validUntil: "2026-06-15T07:00:00.000Z" }),
      linkedStationId: STATION,
    },
  });
  assert.equal(expired.kind, "NO_SCORE");
  if (expired.kind === "NO_SCORE") assert.match(expired.reason, /verlopen/);

  const noLocation = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    sources: {
      water: observation(waterBundle({ [gate.field]: low, stationId: null })),
      linkedStationId: STATION,
    },
  });
  assert.equal(noLocation.kind, "NO_SCORE");
  if (noLocation.kind === "NO_SCORE") assert.match(noLocation.reason, /locatie-id/);

  const invalid = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    sources: {
      water: observation(waterBundle({ [gate.field]: invalidSample(gate.field) })),
      linkedStationId: STATION,
    },
  });
  assert.equal(invalid.kind, "NO_SCORE");
  if (invalid.kind === "NO_SCORE") assert.match(invalid.reason, /geen geldige meting/);

  const partial = scoreSportHours({
    sportId: sport.id,
    hours: calmHours,
    now: NOW,
    sources: {
      water: observation(waterBundle({ [gate.field]: low }), { status: "PARTIAL" }),
      linkedStationId: STATION,
    },
  });
  assert.equal(partial.kind, "NO_SCORE");
  if (partial.kind === "NO_SCORE") assert.match(partial.reason, /dekking/);
  assert.equal(snapshotConsumesQuota(fakeSnapshot(partial, sport.id)), false);

  if (gate.tideReason) {
    const tide = scoreSportHours({
      sportId: sport.id,
      hours: calmHours,
      now: NOW,
      sources: {
        water: observation(waterBundle({ tideTime: "2026-06-15T09:30:00.000Z" })),
        linkedStationId: STATION,
      },
    });
    assert.equal(tide.kind, "NO_SCORE");
    if (tide.kind === "NO_SCORE") {
      assert.equal(tide.reason, gate.tideReason);
      assert.notEqual(tide.reason, present.reason);
    }
  }
}

const scores = new Map<number, number>();
for (let index = 0; index < 48; index += 1) scores.set(index, 20);
scores.set(36, 90);
scores.set(37, 90);
const series = weather(NOW, 48);
const atHour36 = scoreFixtureWindow({
  now: NOW,
  hours: series,
  hourScore: (hour) => scores.get(Math.round((new Date(hour.time).getTime() - NOW.getTime()) / HOUR_MS)) ?? 0,
});
assert.equal(atHour36.kind, "SCORED");
if (atHour36.kind === "SCORED") {
  assert.equal(atHour36.score, 90);
  assert.equal(atHour36.peakWindow.peakScore, 90);
  assert.equal(atHour36.badge, "GOED");
  assert.equal(atHour36.factors[0].impact, 90);
  assert.equal(atHour36.peakWindow.peakTime, new Date(NOW.getTime() + 36 * HOUR_MS).toISOString());
  assert.equal(atHour36.horizon?.usableHours, 48);
  assert.equal(atHour36.horizon?.shortened, false);
  assert.match(atHour36.caveats, /testfixture/i);
}

const peakBesideBad = new Map<number, number>();
for (let index = 0; index < 48; index += 1) peakBesideBad.set(index, 40);
peakBesideBad.set(10, 100);
peakBesideBad.set(11, 0);
peakBesideBad.set(20, 80);
peakBesideBad.set(21, 80);
const beside = scoreFixtureWindow({
  now: NOW,
  hours: series,
  hourScore: (hour) => peakBesideBad.get(Math.round((new Date(hour.time).getTime() - NOW.getTime()) / HOUR_MS)) ?? 0,
});
assert.equal(beside.kind, "SCORED");
if (beside.kind === "SCORED") {
  assert.equal(beside.score, 80);
  assert.equal(beside.peakWindow.peakTime, new Date(NOW.getTime() + 20 * HOUR_MS).toISOString());
  assert.notEqual(beside.score, 100);
  assert.equal(beside.now?.score, 40);
  assert.notEqual(beside.now?.time, beside.peakWindow.peakTime);
}

const gapped = weather(NOW, 2).concat([
  {
    time: new Date(NOW.getTime() + 3 * HOUR_MS).toISOString(),
    temperatureC: 18,
    windKmh: 12,
    precipitationProbability: 10,
    uvIndex: null,
  },
]);
const gap = scoreFixtureWindow({
  now: NOW,
  hours: [gapped[0], gapped[2]],
  hourScore: () => 80,
});
assert.equal(gap.kind, "NO_SCORE");
if (gap.kind === "NO_SCORE") assert.match(gap.reason, /gat|aaneengesloten/i);

const past = scoreFixtureWindow({
  now: NOW,
  hours: weather(new Date(NOW.getTime() - 10 * HOUR_MS), 4),
  hourScore: () => 95,
});
assert.equal(past.kind, "NO_SCORE");
if (past.kind === "NO_SCORE") assert.match(past.reason, /verstreken|verlopen/i);

const unknownUv = scoreFixtureWindow({
  now: NOW,
  hours: weather(NOW, 4, { uvIndex: null }),
  hourScore: () => 60,
});
assert.equal(unknownUv.kind, "SCORED");
if (unknownUv.kind === "SCORED") {
  assert.equal(unknownUv.hourly.every((point) => point.uvIndex === null), true);
  assert.equal(unknownUv.hourly.some((point) => point.uvIndex === 0), false);
}

const shortHorizon = scoreFixtureWindow({
  now: NOW,
  hours: weather(NOW, 6),
  hourScore: () => 60,
});
assert.equal(shortHorizon.kind, "SCORED");
if (shortHorizon.kind === "SCORED") {
  assert.equal(shortHorizon.horizon?.usableHours, 6);
  assert.equal(shortHorizon.horizon?.requestedHours, 48);
  assert.equal(shortHorizon.horizon?.shortened, true);
}

const midNow = new Date(NOW.getTime() + 30 * 60 * 1000);
const openHour = weather(NOW, 49);
const capped = selectUsableHours(openHour, midNow);
assert.equal(capped.length, 48);
assert.equal(capped[0]?.time, NOW.toISOString());
assert.equal(capped.at(-1)?.time, new Date(NOW.getTime() + 47 * HOUR_MS).toISOString());
assert.equal(
  capped.some((hour) => hour.time === new Date(NOW.getTime() + 48 * HOUR_MS).toISOString()),
  false,
);
const cappedHorizon = horizonFor(capped.length);
assert.equal(cappedHorizon.usableHours, 48);
assert.equal(cappedHorizon.shortened, false);
assert.doesNotMatch(cappedHorizon.note, /49/);
assert.equal(selectUsableHours(weather(NOW, 49), NOW).length, 48);
const midShort = horizonFor(selectUsableHours(weather(NOW, 6), midNow).length);
assert.equal(midShort.usableHours, 6);
assert.equal(midShort.shortened, true);
assert.match(midShort.note, /6 geldige uren/);
const overReported = horizonFor(49);
assert.equal(overReported.usableHours, 48);
assert.equal(overReported.shortened, false);
assert.doesNotMatch(overReported.note, /49/);

const expiredForecast = scoreFixtureWindow({
  now: NOW,
  hours: weather(NOW, 48),
  hourScore: () => 90,
  forecastExpired: true,
});
assert.equal(expiredForecast.kind, "NO_SCORE");

assert.equal(formatClock("2026-03-29T00:00:00.000Z"), "01:00");
assert.equal(formatClock("2026-03-29T01:00:00.000Z"), "03:00");
assert.equal(formatClock("2026-10-25T00:00:00.000Z"), "02:00");
assert.equal(formatClock("2026-10-25T01:00:00.000Z"), "02:00");

const tieA = scoreFixtureWindow({
  now: NOW,
  hours: weather(NOW, 8),
  hourScore: (hour) => {
    const index = Math.round((new Date(hour.time).getTime() - NOW.getTime()) / HOUR_MS);
    return index < 4 ? 80 : 80;
  },
});
assert.equal(tieA.kind, "SCORED");
if (tieA.kind === "SCORED") assert.equal(tieA.peakWindow.peakTime, NOW.toISOString());

const draft = {
  sportId: "openwaterzwemmen",
  placeId: PLACE,
  placeLabel: "Amsterdam",
  period: "Komende 48 uur",
  spotId: SPOT,
};
const resolved = { spotId: SPOT, placeId: PLACE, label: "Fixtureplas", waterKind: "stilstaand" as const };
const kept = parseDraft(draft, { resolvedSpot: resolved });
assert.equal(kept?.spotId, SPOT);
const otherPlace = parseDraft({ ...draft, placeId: "wpl-utrecht", placeLabel: "Utrecht" }, { resolvedSpot: resolved });
assert.equal(otherPlace?.spotId, null);
const otherSport = parseDraft({ ...draft, sportId: "fietsen" }, { resolvedSpot: resolved });
assert.equal(otherSport?.spotId, null);
const restoredWithoutProvider = parseDraft(draft);
assert.equal(restoredWithoutProvider?.spotId, null);

const identityA = analysisCacheIdentity("user", kept!);
const identityB = analysisCacheIdentity("user", kept!);
assert.equal(identityA, identityB);
assert.notEqual(identityA, analysisCacheIdentity("user", { ...kept!, spotId: null }));
const current = fakeSnapshot(cool, "openwaterzwemmen");
current.spotId = SPOT;
assert.equal(snapshotIsCurrent(current, kept!), true);
assert.equal(snapshotIsCurrent({ ...current, suitability: { ...cool, modelVersion: "weersport-score-v0.1-provisional" } }, kept!), false);
assert.equal(snapshotConsumesQuota(current), false);
const scoredSnapshot = fakeSnapshot(
  {
    kind: "SCORED",
    modelVersion: FIXTURE_MODEL_VERSION,
    score: 85,
    badge: "GOED",
    peakWindow: {
      start: NOW.toISOString(),
      end: new Date(NOW.getTime() + HOUR_MS).toISOString(),
      peakTime: NOW.toISOString(),
      peakScore: 85,
      label: "Beste moment · fixture",
    },
    bestTimeLabel: "Beste moment · fixture",
    hourly: [],
    factors: [],
    tooltip: FIXTURE_LABEL,
    caveats: FIXTURE_LABEL,
  },
  "fietsen",
);
assert.equal(snapshotConsumesQuota(scoredSnapshot), true);
assert.equal(scoredSnapshot.suitability.kind === "SCORED" && scoredSnapshot.suitability.score, 85);
assert.equal(quotaBlocksSnapshot(0, false), false);
assert.equal(quotaBlocksSnapshot(0, true), true);
assert.equal(quotaBlocksSnapshot(1, false), false);
const analysisSource = readFileSync(new URL("../lib/billing/analysis.ts", import.meta.url), "utf8");
const buildAt = analysisSource.indexOf("await buildForecastSnapshot");
const freeAt = analysisSource.indexOf("if (!snapshotConsumesQuota(snapshot))");
const blockAt = analysisSource.indexOf("quotaBlocksSnapshot(entitlement.remaining, true)");
const cacheAfterBlock = analysisSource.indexOf("writeCache(input.userId, cacheKey, snapshot)", blockAt);
assert.ok(buildAt >= 0 && freeAt > buildAt && blockAt > freeAt && cacheAfterBlock > blockAt);

const scoredDecision = decideAdPlacement({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  suitabilityKind: "SCORED",
});
assert.equal(scoredDecision.allowed, true);
const blockedDecision = decideAdPlacement({
  surface: "moment",
  plan: "basis",
  consentGranted: true,
  suitabilityKind: "NO_SCORE",
});
assert.equal(blockedDecision.allowed, false);

process.env.WEERSPORT_DB = path.join(mkdtempSync(path.join(tmpdir(), "weersport-moments-")), "moments.sqlite");
const rejectedDraft = parseDraft({ ...draft, spotId: "spot-rejected" });
assert.equal(rejectedDraft?.spotId, null);
const rejectedMoment = createPlannedMoment("user-rejected-spot", {
  draft: rejectedDraft!,
  windowLabel: "plan",
  plannedStart: NOW.toISOString(),
  plannedEnd: new Date(NOW.getTime() + HOUR_MS).toISOString(),
});
assert.equal(rejectedMoment.spotId, null);
const keptMoment = createPlannedMoment("user-kept-spot", {
  draft: kept!,
  windowLabel: "plan",
  plannedStart: NOW.toISOString(),
  plannedEnd: new Date(NOW.getTime() + HOUR_MS).toISOString(),
});
assert.equal(keptMoment.spotId, SPOT);
const momentsRoute = readFileSync(new URL("../app/api/moments/route.ts", import.meta.url), "utf8");
const momentsStore = readFileSync(new URL("../lib/moments/store.ts", import.meta.url), "utf8");
assert.doesNotMatch(momentsRoute, /body\?\.spotId|body\.spotId/);
assert.doesNotMatch(momentsStore, /input\.spotId/);
assert.match(momentsStore, /input\.draft\.spotId/);

const momentsPage = readFileSync(new URL("../app/account/momenten/page.tsx", import.meta.url), "utf8");
assert.equal(momentsPage.includes("runMeteredAnalysis"), false);
assert.match(momentsPage, /Gedateerd archief/);
const header = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
assert.match(header, /\/api\/auth\/sessie/);
assert.match(header, /Inloggen/);
assert.match(header, /Mijn momenten/);
const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
assert.match(home, /preselectedSportId/);
assert.match(home, /params\.sport/);

const windowA = scoreFixtureWindow({
  now: NOW,
  hours: weather(NOW, 4),
  hourScore: (hour) => (hour.time === NOW.toISOString() || hour.time === new Date(NOW.getTime() + HOUR_MS).toISOString() ? 40 : 10),
});
const windowB = scoreFixtureWindow({
  now: NOW,
  hours: weather(NOW, 4),
  hourScore: (hour) => (hour.time === new Date(NOW.getTime() + 2 * HOUR_MS).toISOString() || hour.time === new Date(NOW.getTime() + 3 * HOUR_MS).toISOString() ? 85 : 10),
});
assert.equal(windowA.kind, "SCORED");
assert.equal(windowB.kind, "SCORED");
if (windowA.kind === "SCORED" && windowB.kind === "SCORED") {
  assert.equal(windowA.score, 40);
  assert.equal(windowB.score, 85);
  assert.notEqual(windowA.peakWindow.peakTime, windowB.peakWindow.peakTime);
  console.log(
    `fixture window comparison (${FIXTURE_MODEL_VERSION}, ${FIXTURE_LABEL}): A ${windowA.score} vanaf ${windowA.peakWindow.label}; B ${windowB.score} vanaf ${windowB.peakWindow.label}`,
  );
}

console.log("score behavior ok");
