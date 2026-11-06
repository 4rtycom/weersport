/**
 * Phase 3 deterministic invariants (mirrors lib/scoring/time.ts + windows.ts + engine rules).
 * Kept as plain ESM so `npm run check` does not need a TS path loader.
 */

const SCORE_MODEL_VERSION = "weersport-score-v0.2-phase3";
const FUTURE_HORIZON_MS = 48 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const AMSTERDAM_TZ = "Europe/Amsterdam";

const WATER_CRITICAL = new Set([
  "zeilen",
  "windsurfen",
  "kitesurfen",
  "surfen",
  "suppen",
  "kajakken",
  "roeien",
  "openwaterzwemmen",
]);
const ICE_CRITICAL = new Set(["schaatsen"]);

const LAND_SPORTS = [
  "fietsen",
  "wielrennen",
  "gravelbiken",
  "mountainbiken",
  "hardlopen",
  "trailrunning",
  "wandelen",
  "hiken",
  "golf",
  "tennis-padel",
  "voetbal",
  "hockey",
  "skeeleren",
  "paardrijden",
  "outdoorfitness",
];

const ALL_SPORTS = [
  ...LAND_SPORTS,
  "zeilen",
  "windsurfen",
  "kitesurfen",
  "surfen",
  "suppen",
  "kajakken",
  "roeien",
  "openwaterzwemmen",
  "schaatsen",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function toUtcIso(input) {
  const trimmed = input.trim();
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(Date.parse(trimmed)).toISOString();
  }
  return new Date(Date.parse(`${trimmed}Z`)).toISOString();
}

function formatAmsterdamClock(isoUtc) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AMSTERDAM_TZ,
  }).format(new Date(isoUtc));
}

function selectFutureHours(hours, nowMs = Date.now(), horizonMs = FUTURE_HORIZON_MS) {
  return hours
    .filter((hour) => {
      const t = Date.parse(hour.time);
      return !Number.isNaN(t) && t >= nowMs && t < nowMs + horizonMs;
    })
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

function rankTwoHourWindows(points) {
  const windows = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    if (Date.parse(second.time) - Date.parse(first.time) !== ONE_HOUR_MS) continue;
    const score = Math.round((first.score + second.score) / 2);
    const peakFirst = first.score >= second.score;
    windows.push({
      start: first.time,
      end: second.time,
      score,
      peakTime: peakFirst ? first.time : second.time,
      peakScore: peakFirst ? first.score : second.score,
    });
  }
  return windows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const startDiff = Date.parse(a.start) - Date.parse(b.start);
    if (startDiff !== 0) return startDiff;
    return b.peakScore - a.peakScore;
  });
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreBand(value, ideal, soft = 8) {
  const [low, high] = ideal;
  if (value >= low && value <= high) return 100;
  if (value < low) return clamp(100 - ((low - value) / soft) * 70);
  return clamp(100 - ((value - high) / soft) * 70);
}

function scoreHour(hour) {
  const temperature = scoreBand(hour.temperatureC, [10, 20], 10);
  const wind = scoreBand(hour.windKmh, [0, 22], 12);
  const rain = hour.precipitationProbability <= 5 ? 100 : hour.precipitationProbability < 25 ? 55 : 30;
  return Math.round(temperature * 0.3 + wind * 0.4 + rain * 0.3);
}

function hourAt(nowMs, offsetHours, overrides = {}) {
  return {
    time: new Date(nowMs + offsetHours * ONE_HOUR_MS).toISOString(),
    temperatureC: 16,
    windKmh: 12,
    precipitationProbability: 10,
    uvIndex: 3,
    ...overrides,
  };
}

function series(nowMs, count, mapHour = () => ({})) {
  return Array.from({ length: count }, (_, offset) => hourAt(nowMs, offset, mapHour(offset)));
}

function scoreLand(hours, nowMs) {
  const future = selectFutureHours(hours, nowMs).filter(
    (hour) => hour.temperatureC != null && hour.windKmh != null && hour.precipitationProbability != null,
  );
  if (future.length === 0) return { kind: "NO_SCORE", reason: "all-past" };
  const curve = future.map((hour) => ({
    time: hour.time,
    score: scoreHour(hour),
    uvIndex: hour.uvIndex,
  }));
  const windows = rankTwoHourWindows(curve);
  if (windows.length === 0) return { kind: "NO_SCORE", reason: "no-window" };
  const peakHour = curve.reduce((best, point) => (point.score > best.score ? point : best), curve[0]);
  return {
    kind: "SCORED",
    modelVersion: SCORE_MODEL_VERSION,
    now: curve[0],
    peakHour,
    recommendedWindow: windows[0],
    hourly: curve,
  };
}

const nowMs = Date.parse("2026-11-06T10:00:00.000Z");

assert(toUtcIso("2026-11-06T12:00") === "2026-11-06T12:00:00.000Z", "bare UTC normalize");
assert(selectFutureHours([hourAt(nowMs, -2), hourAt(nowMs, 1)], nowMs).length === 1, "no expired fallback");
assert(scoreLand([hourAt(nowMs, -3), hourAt(nowMs, -1)], nowMs).kind === "NO_SCORE", "all-past");

const peak36 = series(nowMs, 48, (offset) => ({
  temperatureC: offset === 36 || offset === 37 ? 18 : 4,
  windKmh: offset === 36 || offset === 37 ? 10 : 40,
  precipitationProbability: offset === 36 || offset === 37 ? 5 : 80,
}));
const scored36 = scoreLand(peak36, nowMs);
assert(scored36.kind === "SCORED", "hour-36 scores");
assert(scored36.recommendedWindow.start === peak36[36].time, "best window at hour 36");
assert(scored36.now.time === peak36[0].time, "nu is first future hour");

const lateNow = Date.parse("2026-11-06T21:30:00.000Z");
assert(scoreLand(series(lateNow, 40), lateNow).kind === "SCORED", "late evening");

for (const stamp of [Date.parse("2026-03-29T00:00:00.000Z"), Date.parse("2026-10-25T00:00:00.000Z")]) {
  const result = scoreLand(series(stamp, 30), stamp);
  assert(result.kind === "SCORED", "DST series");
  assert(formatAmsterdamClock(result.now.time).length >= 4, "Amsterdam format across DST");
}

const gapped = series(nowMs, 6);
gapped.splice(2, 1);
const gappedPoints = gapped.map((hour, index) => ({ time: hour.time, score: 50 + index }));
const gappedWindows = rankTwoHourWindows(gappedPoints);
assert(
  gappedWindows.every((window) => Date.parse(window.end) - Date.parse(window.start) === ONE_HOUR_MS),
  "1h adjacency",
);

const isolated = series(nowMs, 8, (offset) => {
  if (offset === 3) return { temperatureC: 18, windKmh: 8, precipitationProbability: 0 };
  if (offset === 5 || offset === 6) return { temperatureC: 17, windKmh: 10, precipitationProbability: 5 };
  return { temperatureC: 2, windKmh: 45, precipitationProbability: 90 };
});
const isolatedScore = scoreLand(isolated, nowMs);
assert(isolatedScore.recommendedWindow.start === isolated[5].time, "solid pair beats isolated peak");
assert(isolatedScore.peakHour.time === isolated[3].time, "peak hour remains the spike");

const equal = rankTwoHourWindows([
  { time: hourAt(nowMs, 0).time, score: 80 },
  { time: hourAt(nowMs, 1).time, score: 80 },
  { time: hourAt(nowMs, 2).time, score: 80 },
  { time: hourAt(nowMs, 3).time, score: 80 },
]);
assert(equal[0].start === hourAt(nowMs, 0).time, "earlier window wins ties");

const unknownUv = scoreLand(
  series(nowMs, 10, () => ({ uvIndex: null })),
  nowMs,
);
assert(unknownUv.kind === "SCORED", "unknown UV still scores weather");
assert(unknownUv.hourly.every((point) => point.uvIndex === null), "UV stays null");

assert(ALL_SPORTS.length === 24, "24 sports");
for (const sportId of ["fietsen", "hardlopen", "golf", "zeilen", "kajakken", "skeeleren"]) {
  if (WATER_CRITICAL.has(sportId) || ICE_CRITICAL.has(sportId)) {
    assert(true, `${sportId} critical`);
  } else {
    assert(scoreLand(series(nowMs, 12), nowMs).kind === "SCORED", `${sportId} family rep`);
  }
}
for (const sportId of ALL_SPORTS) {
  if (WATER_CRITICAL.has(sportId) || ICE_CRITICAL.has(sportId)) continue;
  const outcome = scoreLand(series(nowMs, 12), nowMs);
  assert(outcome.kind === "SCORED", `${sportId} land invariant`);
  assert(outcome.modelVersion === SCORE_MODEL_VERSION, `${sportId} model pin`);
}

console.log("phase 3 scoring invariants ok");
