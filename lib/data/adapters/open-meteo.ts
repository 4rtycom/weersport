import { classifyUv } from "@/lib/data/uv";
import type { SourceObservation, UvBundle, WeatherBundle, WeatherHour } from "@/lib/data/types";
import { FUTURE_HORIZON_MS, toUtcIso } from "@/lib/scoring/time";

type OpenMeteoResponse = {
  generationtime_ms?: number;
  utc_offset_seconds?: number;
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    uv_index?: Array<number | null>;
  };
};

/**
 * Open-Meteo forecast adapter (Phase 3).
 * - Requests UTC hourly series with enough lead for 48 future elapsed hours.
 * - Normalizes valid times to UTC ISO at ingestion.
 * - Distinguishes receipt time, optional model publication, and forecast-valid range.
 * - Never substitutes expired hours for “current”.
 */
export async function fetchOpenMeteoWeather(input: {
  latitude: number;
  longitude: number;
  placeLabel: string;
  nowMs?: number;
}): Promise<{ weather: SourceObservation<WeatherBundle>; uv: SourceObservation<UvBundle> }> {
  const receivedAt = new Date().toISOString();
  const nowMs = input.nowMs ?? Date.now();
  const rights =
    "Open-Meteo CC BY 4.0 met bronvermelding. Commerciële vendorkeuze en hergebruikrechten blijven open tot expliciete goedkeuring.";
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(input.latitude));
    url.searchParams.set("longitude", String(input.longitude));
    url.searchParams.set(
      "hourly",
      "temperature_2m,precipitation_probability,wind_speed_10m,uv_index",
    );
    // 3 forecast days ensures ≥48 future elapsed hours regardless of time-of-day.
    url.searchParams.set("forecast_days", "3");
    url.searchParams.set("timezone", "UTC");
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as OpenMeteoResponse;
    const times = body.hourly?.time ?? [];
    if (times.length === 0) throw new Error("Geen uurdata");

    const allHours: WeatherHour[] = times.map((time, index) => ({
      time: toUtcIso(time),
      temperatureC: body.hourly?.temperature_2m?.[index] ?? null,
      windKmh: body.hourly?.wind_speed_10m?.[index] ?? null,
      precipitationProbability: body.hourly?.precipitation_probability?.[index] ?? null,
      uvIndex: body.hourly?.uv_index?.[index] ?? null,
    }));

    const futureHours = allHours.filter((hour) => {
      const t = Date.parse(hour.time);
      return t >= nowMs && t < nowMs + FUTURE_HORIZON_MS;
    });

    if (futureHours.length === 0) {
      throw new Error("Geen toekomstige uren binnen 48 uur");
    }

    const current = futureHours[0];
    const maxUv = futureHours.reduce<number | null>((max, hour) => {
      if (hour.uvIndex === null) return max;
      return max === null ? hour.uvIndex : Math.max(max, hour.uvIndex);
    }, null);
    const uv = classifyUv(maxUv);
    // Open-Meteo exposes generationtime_ms as processing latency, not model run time.
    const modelPublishedAt = null;
    const timeline = {
      receivedAt,
      modelPublishedAt,
      forecastValidFrom: futureHours[0]?.time ?? null,
      forecastValidUntil: futureHours.at(-1)?.time ?? null,
    };

    return {
      weather: {
        sourceId: "open-meteo",
        sourceLabel: "Open-Meteo (voorlopige weeradapter)",
        status: "READY",
        rightsNote: rights,
        coverageNote: "UTC-uurreeksen; weergave in Europe/Amsterdam. Geen KNMI-officiële waarneming.",
        publishedAt: modelPublishedAt,
        receivedAt,
        validUntil: timeline.forecastValidUntil,
        locationLabel: input.placeLabel,
        demo: false,
        value: {
          temperatureC: current.temperatureC,
          windKmh: current.windKmh,
          precipitationProbability: current.precipitationProbability,
          hours: futureHours,
          timeline,
        },
        message: `Weer-uurdata (UTC) · ${futureHours.length} toekomstige uren · geldig ${timeline.forecastValidFrom} → ${timeline.forecastValidUntil}.`,
      },
      uv: {
        sourceId: "open-meteo-uv",
        sourceLabel: "Open-Meteo UV",
        status: uv.index === null ? "MISSING_CRITICAL" : "READY",
        rightsNote: rights,
        coverageNote: "Maximale UV in het komende 48-uursvenster. Ontbrekende UV blijft onbekend.",
        publishedAt: modelPublishedAt,
        receivedAt,
        validUntil: timeline.forecastValidUntil,
        locationLabel: input.placeLabel,
        demo: false,
        value: uv,
        message:
          uv.index === null
            ? "UV niet beschikbaar. Er is geen geïmproviseerd cijfer getoond."
            : `UV-index ${uv.index.toFixed(uv.index % 1 === 0 ? 0 : 1)} · ${uv.label}`,
      },
    };
  } catch {
    return {
      weather: {
        sourceId: "open-meteo",
        sourceLabel: "Open-Meteo (voorlopige weeradapter)",
        status: "MISSING_CRITICAL",
        rightsNote: rights,
        coverageNote: "Geen actuele uurdata ontvangen.",
        publishedAt: null,
        receivedAt,
        validUntil: null,
        locationLabel: input.placeLabel,
        demo: false,
        value: null,
        message: "Weerbron is niet bereikbaar. Er is geen fictieve temperatuur of wind getoond.",
      },
      uv: {
        sourceId: "open-meteo-uv",
        sourceLabel: "Open-Meteo UV",
        status: "MISSING_CRITICAL",
        rightsNote: rights,
        coverageNote: "Geen UV-voorspelling ontvangen.",
        publishedAt: null,
        receivedAt,
        validUntil: null,
        locationLabel: input.placeLabel,
        demo: false,
        value: classifyUv(null),
        message: "UV niet beschikbaar. Er is geen geïmproviseerd cijfer getoond.",
      },
    };
  }
}
