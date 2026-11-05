export type SourceStatus =
  | "READY"
  | "PARTIAL"
  | "STALE"
  | "MISSING_CRITICAL"
  | "TEST_ONLY"
  | "OFFICIAL_WARNING"
  | "NOT_LINKED";

export type SourceObservation<T> = {
  sourceId: string;
  sourceLabel: string;
  status: SourceStatus;
  rightsNote: string;
  coverageNote: string;
  publishedAt: string | null;
  receivedAt: string;
  validUntil: string | null;
  locationLabel: string | null;
  demo: boolean;
  value: T | null;
  message: string;
};

export type WeatherHour = {
  time: string;
  temperatureC: number | null;
  windKmh: number | null;
  precipitationProbability: number | null;
  uvIndex: number | null;
};

export type WeatherBundle = {
  temperatureC: number | null;
  windKmh: number | null;
  precipitationProbability: number | null;
  hours: WeatherHour[];
};

export type UvBundle = {
  index: number | null;
  level: "laag" | "matig" | "hoog" | "zeer-hoog" | "extreem" | null;
  label: string;
};

export type WarningBundle = {
  items: Array<{ title: string; detail: string }>;
};

export type WaterBundle = {
  waterTemperatureC: number | null;
  waveHeightM: number | null;
  currentMs: number | null;
};

export type SwimBundle = {
  advice: string | null;
  quality: string | null;
};

export type SuitabilityOutcome =
  | { kind: "NO_SCORE"; reason: string }
  | { kind: "PENDING_PHASE_04"; reason: string };

export type ForecastSnapshot = {
  sportId: string;
  sportName: string;
  placeLabel: string;
  period: string;
  generatedAt: string;
  weather: SourceObservation<WeatherBundle>;
  uv: SourceObservation<UvBundle>;
  warnings: SourceObservation<WarningBundle>;
  water: SourceObservation<WaterBundle>;
  swim: SourceObservation<SwimBundle>;
  suitability: SuitabilityOutcome;
  sources: Array<{
    id: string;
    label: string;
    status: SourceStatus;
    message: string;
    rightsNote: string;
  }>;
};

export const WATER_CRITICAL_SPORTS = new Set([
  "zeilen",
  "windsurfen",
  "kitesurfen",
  "surfen",
  "suppen",
  "kajakken",
  "roeien",
  "openwaterzwemmen",
]);

export const ICE_CRITICAL_SPORTS = new Set(["schaatsen"]);
