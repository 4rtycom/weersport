export type SourceStatus =
  | "READY"
  | "PARTIAL"
  | "STALE"
  | "MISSING_CRITICAL"
  | "TEST_ONLY"
  | "OFFICIAL_WARNING"
  | "NOT_LINKED"
  | "NOT_COVERED"
  | "ERROR";

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

export type WarningItem = {
  title: string;
  detail: string;
  code?: "geel" | "oranje" | "rood";
  phenomenon?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  attribution?: string;
};

export type WarningBundle = {
  items: WarningItem[];
};

export type WaterReading = {
  parameter: string;
  label: string;
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  stationId: string;
  stationLabel: string;
  distanceKm: number | null;
  qualityCode: string | null;
  coverage: "EXACT" | "REPRESENTATIVE" | "NONE";
};

export type WaterBundle = {
  waterTemperatureC: number | null;
  waveHeightM: number | null;
  currentMs: number | null;
  readings?: WaterReading[];
};

export type AirReading = {
  formula: "PM25" | "PM10" | "NO2" | "O3" | "LKI";
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  stationId: string | null;
  stationLabel: string | null;
  stationType: string | null;
  distanceKm: number | null;
  fresh: boolean;
};

export type AirBundle = {
  readings: AirReading[];
  note: string;
};

export type SafetyLevel = "UNKNOWN" | "NONE_IN_WINDOW" | "YELLOW" | "ORANGE" | "RED";

export type SafetyState = {
  level: SafetyLevel;
  summary: string;
  comfortIsNotSafety: boolean;
};

export type SwimBundle = {
  advice: string | null;
  quality: string | null;
};

export type SuitabilityFactor = {
  id: string;
  label: string;
  impact: number;
  explanation: string;
};

export type HourlyScorePoint = {
  time: string;
  score: number;
  temperatureC: number;
  windKmh: number;
  precipitationProbability: number;
  uvIndex: number | null;
};

export type SuitabilityOutcome =
  | { kind: "NO_SCORE"; reason: string; missing?: string[] }
  | {
      kind: "SCORED";
      modelVersion: string;
      score: number;
      badge: "GOED" | "MATIG" | "SLECHT";
      peakWindow: {
        start: string;
        end: string;
        peakTime: string;
        peakScore: number;
        label: string;
      };
      bestTimeLabel: string;
      hourly: HourlyScorePoint[];
      factors: SuitabilityFactor[];
      tooltip: string;
      caveats: string;
    };

export type ForecastSnapshot = {
  sportId: string;
  sportName: string;
  placeId: string;
  placeLabel: string;
  period: string;
  generatedAt: string;
  weather: SourceObservation<WeatherBundle>;
  uv: SourceObservation<UvBundle>;
  warnings: SourceObservation<WarningBundle>;
  water: SourceObservation<WaterBundle>;
  swim: SourceObservation<SwimBundle>;
  airQuality?: SourceObservation<AirBundle>;
  safety?: SafetyState;
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
