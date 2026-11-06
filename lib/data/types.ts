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

export type WaterKind = "stilstaand" | "stromend" | "kust" | "onbekend";

export type WaterBundle = {
  waterTemperatureC: number | null;
  waveHeightM: number | null;
  currentMs: number | null;
  /** Degrees from north, only when a source measured direction. */
  currentDirectionDeg?: number | null;
  waterKind?: WaterKind | null;
  /** Source text for exposure. Not inferred from wind. */
  exposure?: string | null;
  /** A tide clock is stored so it can be rejected as a current measurement. */
  tideTime?: string | null;
  stationId?: string | null;
};

export type SwimBundle = {
  advice: string | null;
  quality: string | null;
  spotId?: string | null;
  spotLabel?: string | null;
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
  /** Unknown UV stays null. It is never coerced to zero. */
  uvIndex: number | null;
};

export type ShownMeasurement = {
  id: string;
  label: string;
  display: string;
  sourceLabel: string;
  observedAt: string | null;
  quality: "measured" | "predicted" | "unknown" | "expired" | "not_applicable";
};

export type ScoreHorizon = {
  requestedHours: number;
  usableHours: number;
  shortened: boolean;
  note: string;
};

export type SuitabilityOutcome =
  | {
      kind: "NO_SCORE";
      reason: string;
      missing?: string[];
      modelVersion: string;
      blocked?: boolean;
      measurements?: ShownMeasurement[];
      horizon?: ScoreHorizon;
    }
  | {
      kind: "SCORED";
      modelVersion: string;
      /** Window aggregate. Badge, factors, and the best-moment label use this same value. */
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
      /** Current hour, when it is also available. Not the best-moment window. */
      now?: { time: string; score: number; label: string } | null;
      horizon?: ScoreHorizon;
      aggregation?: string;
      tieBreak?: string;
    };

export type ForecastSnapshot = {
  sportId: string;
  sportName: string;
  placeId: string;
  placeLabel: string;
  period: string;
  /** Official swim spot used for this request. Null when none is linked. */
  spotId: string | null;
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
