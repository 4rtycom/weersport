import { sports } from "@/lib/sports";

/**
 * Phase 2 exit evidence: sport-by-sport dependency matrix (24 rows).
 * Critical inputs must be linked with adequate spatial coverage before scoring.
 */

export type CriticalInput =
  | "weather-hourly"
  | "uv"
  | "knmi-warnings"
  | "water-conditions"
  | "swim-quality"
  | "ice-evidence";

export type SportDependencyRow = {
  sportId: string;
  sportName: string;
  familyId: string;
  terrain: "land" | "water" | "ice";
  required: CriticalInput[];
  /** Inputs that block scoring (NO_SCORE) when missing or coverage-insufficient. */
  scoreBlocking: CriticalInput[];
  /** Always shown independently of quota/score. */
  safetyIndependent: CriticalInput[];
  coverageNote: string;
};

const LAND_REQUIRED: CriticalInput[] = ["weather-hourly", "uv", "knmi-warnings"];
const WATER_REQUIRED: CriticalInput[] = [
  "weather-hourly",
  "uv",
  "knmi-warnings",
  "water-conditions",
];
const SWIM_REQUIRED: CriticalInput[] = [
  "weather-hourly",
  "uv",
  "knmi-warnings",
  "water-conditions",
  "swim-quality",
];
const ICE_REQUIRED: CriticalInput[] = ["weather-hourly", "uv", "knmi-warnings", "ice-evidence"];

const WATER_IDS = new Set([
  "zeilen",
  "windsurfen",
  "kitesurfen",
  "surfen",
  "suppen",
  "kajakken",
  "roeien",
]);

function rowFor(sportId: string, sportName: string, familyId: string): SportDependencyRow {
  if (sportId === "schaatsen") {
    return {
      sportId,
      sportName,
      familyId,
      terrain: "ice",
      required: ICE_REQUIRED,
      scoreBlocking: ["ice-evidence"],
      safetyIndependent: ["knmi-warnings", "uv"],
      coverageNote:
        "IJsvereist sitespecifieke dikte/kwaliteit. Woonplaatscentroïde en luchttemperatuur volstaan niet.",
    };
  }
  if (sportId === "openwaterzwemmen") {
    return {
      sportId,
      sportName,
      familyId,
      terrain: "water",
      required: SWIM_REQUIRED,
      scoreBlocking: ["water-conditions", "swim-quality"],
      safetyIndependent: ["knmi-warnings", "uv", "swim-quality"],
      coverageNote:
        "Open water + officiële zwemwaterstatus op de gekozen waterlocatie. Stadcentroïde is onvoldoende.",
    };
  }
  if (WATER_IDS.has(sportId)) {
    return {
      sportId,
      sportName,
      familyId,
      terrain: "water",
      required: WATER_REQUIRED,
      scoreBlocking: ["water-conditions"],
      safetyIndependent: ["knmi-warnings", "uv"],
      coverageNote:
        "Watercondities (temperatuur/golven/stroming) op het waterlichaam. Geen claim vanaf alleen een plaatsnaam.",
    };
  }
  return {
    sportId,
    sportName,
    familyId,
    terrain: "land",
    required: LAND_REQUIRED,
    scoreBlocking: ["weather-hourly"],
    safetyIndependent: ["knmi-warnings", "uv"],
    coverageNote: "Landsportdekking via weer/UV; officiële waarschuwingen blijven parallel zichtbaar.",
  };
}

export const SPORT_DEPENDENCY_MATRIX: SportDependencyRow[] = sports.map((sport) =>
  rowFor(sport.id, sport.name, sport.familyId),
);

export function sportDependency(sportId: string) {
  return SPORT_DEPENDENCY_MATRIX.find((row) => row.sportId === sportId) ?? rowFor(sportId, sportId, "unknown");
}

export function assertCompleteMatrix() {
  if (SPORT_DEPENDENCY_MATRIX.length !== 24) {
    throw new Error(`Expected 24 sports in dependency matrix, got ${SPORT_DEPENDENCY_MATRIX.length}`);
  }
  const ids = new Set(SPORT_DEPENDENCY_MATRIX.map((row) => row.sportId));
  for (const sport of sports) {
    if (!ids.has(sport.id)) throw new Error(`Missing dependency row for ${sport.id}`);
  }
}
