import { classifyUv } from "@/lib/data/uv";
import type { SourceObservation, UvBundle, WeatherBundle } from "@/lib/data/types";

type OpenMeteoResponse = {
  utc_offset_seconds?: number;
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    uv_index?: Array<number | null>;
  };
};

const HOUR_MS = 60 * 60 * 1000;
const FORECAST_WINDOW_MS = 48 * HOUR_MS;

function stamp(partial: Omit<SourceObservation<WeatherBundle>, "receivedAt">): SourceObservation<WeatherBundle> {
  return { ...partial, receivedAt: new Date().toISOString() };
}

// Hourly times are local clock readings without an offset. `utc_offset_seconds` is that zone's offset.
function localTimestampMs(time: string, utcOffsetSeconds: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(time);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second] = match;
  return (
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0)) -
    utcOffsetSeconds * 1000
  );
}

export async function fetchOpenMeteoWeather(input: {
  latitude: number;
  longitude: number;
  placeLabel: string;
}): Promise<{ weather: SourceObservation<WeatherBundle>; uv: SourceObservation<UvBundle> }> {
  const receivedAt = new Date().toISOString();
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
    // Counted from the current local hour, so 49 steps still include the last hour inside now+48h.
    url.searchParams.set("forecast_hours", "49");
    url.searchParams.set("timezone", "Europe/Amsterdam");
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as OpenMeteoResponse;
    const times = body.hourly?.time ?? [];
    const utcOffsetSeconds = body.utc_offset_seconds;
    if (times.length === 0 || typeof utcOffsetSeconds !== "number") throw new Error("Geen uurdata");

    const points = times.map((time, index) => ({
      time,
      timeMs: localTimestampMs(time, utcOffsetSeconds),
      temperatureC: body.hourly?.temperature_2m?.[index] ?? null,
      windKmh: body.hourly?.wind_speed_10m?.[index] ?? null,
      precipitationProbability: body.hourly?.precipitation_probability?.[index] ?? null,
      uvIndex: body.hourly?.uv_index?.[index] ?? null,
    }));

    const now = Date.now();
    let nearest = points[0];
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const hour of points) {
      if (!Number.isFinite(hour.timeMs)) continue;
      const dist = Math.abs(hour.timeMs - now);
      if (dist < nearestDist) {
        nearest = hour;
        nearestDist = dist;
      }
    }
    if (!Number.isFinite(nearest.timeMs)) throw new Error("Geen bruikbare tijdstippen");
    const current = nearestDist <= HOUR_MS;

    const hours = points
      .filter((hour) => hour.timeMs >= now && hour.timeMs <= now + FORECAST_WINDOW_MS)
      .map((hour) => ({
        time: hour.time,
        temperatureC: hour.temperatureC,
        windKmh: hour.windKmh,
        precipitationProbability: hour.precipitationProbability,
        uvIndex: hour.uvIndex,
      }));
    const maxUv = hours.reduce<number | null>((max, hour) => {
      if (hour.uvIndex === null) return max;
      return max === null ? hour.uvIndex : Math.max(max, hour.uvIndex);
    }, null);
    const uv = classifyUv(maxUv);

    return {
      weather: stamp({
        sourceId: "open-meteo",
        sourceLabel: "Open-Meteo (voorlopige weeradapter)",
        status: current ? "READY" : "STALE",
        rightsNote: rights,
        coverageNote: "Wereldwijde modelvoorspelling; geen KNMI-officiële waarneming.",
        publishedAt: nearest.time,
        validUntil: hours.at(-1)?.time ?? null,
        locationLabel: input.placeLabel,
        demo: false,
        value: {
          temperatureC: current ? nearest.temperatureC : null,
          windKmh: current ? nearest.windKmh : null,
          precipitationProbability: current ? nearest.precipitationProbability : null,
          hours,
        },
        message: current
          ? "Weer-uurdata ontvangen via Open-Meteo."
          : "Geen uur dicht bij nu. Actuele meting is niet als live weer getoond.",
      }),
      uv: {
        sourceId: "open-meteo-uv",
        sourceLabel: "Open-Meteo UV",
        status: uv.index === null ? "MISSING_CRITICAL" : "READY",
        rightsNote: rights,
        coverageNote: "Maximale UV in het komende 48-uursvenster voor de gekozen plaats.",
        publishedAt: nearest.time,
        receivedAt,
        validUntil: hours.at(-1)?.time ?? null,
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
    const emptyWeather = stamp({
      sourceId: "open-meteo",
      sourceLabel: "Open-Meteo (voorlopige weeradapter)",
      status: "MISSING_CRITICAL",
      rightsNote: rights,
      coverageNote: "Geen actuele uurdata ontvangen.",
      publishedAt: null,
      validUntil: null,
      locationLabel: input.placeLabel,
      demo: false,
      value: null,
      message: "Weerbron is niet bereikbaar. Er is geen fictieve temperatuur of wind getoond.",
    });
    return {
      weather: emptyWeather,
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
