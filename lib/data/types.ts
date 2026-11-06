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
  lifecycle:
    | "provider-failure"
    | "verified-all-clear"
    | "active-warning"
    | "stale"
    | "not-linked"
    | "partial-coverage";
  spatialCoverage: string | null;
  lastSuccessAt: string | null;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    code?: "geel" | "oranje" | "rood" | "none";
    spatialScope: string;
    issuedAt: string;
    expiresAt: string | null;
    eventStartAt: string | null;
    eventEndAt: string | null;
    provenance: string;
  }>;
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
  uvIndex: number;
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
  suitability: SuitabilityOutcome;
  coverage: {
    kind: "town-centroid" | "site-specific" | "unknown";
    note: string;
  };
  dependencies: {
    terrain: "land" | "water" | "ice";
    required: string[];
    scoreBlocking: string[];
    coverageNote: string;
  };
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
