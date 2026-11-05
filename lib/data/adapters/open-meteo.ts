import { classifyUv } from "@/lib/data/uv";
import type { SourceObservation, UvBundle, WeatherBundle } from "@/lib/data/types";

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    uv_index?: Array<number | null>;
  };
};

function stamp(partial: Omit<SourceObservation<WeatherBundle>, "receivedAt">): SourceObservation<WeatherBundle> {
  return { ...partial, receivedAt: new Date().toISOString() };
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
    url.searchParams.set("forecast_days", "2");
    url.searchParams.set("timezone", "Europe/Amsterdam");
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as OpenMeteoResponse;
    const times = body.hourly?.time ?? [];
    if (times.length === 0) throw new Error("Geen uurdata");

    const hours = times.slice(0, 48).map((time, index) => ({
      time,
      temperatureC: body.hourly?.temperature_2m?.[index] ?? null,
      windKmh: body.hourly?.wind_speed_10m?.[index] ?? null,
      precipitationProbability: body.hourly?.precipitation_probability?.[index] ?? null,
      uvIndex: body.hourly?.uv_index?.[index] ?? null,
    }));

    const now = Date.now();
    const nearest =
      hours.find((hour) => new Date(hour.time).getTime() >= now) ?? hours[0];
    const dayHours = hours.filter((hour) => {
      const stampMs = new Date(hour.time).getTime();
      return stampMs >= now && stampMs <= now + 48 * 60 * 60 * 1000;
    });
    const maxUv = dayHours.reduce<number | null>((max, hour) => {
      if (hour.uvIndex === null) return max;
      return max === null ? hour.uvIndex : Math.max(max, hour.uvIndex);
    }, null);
    const uv = classifyUv(maxUv);

    return {
      weather: stamp({
        sourceId: "open-meteo",
        sourceLabel: "Open-Meteo (voorlopige weeradapter)",
        status: "READY",
        rightsNote: rights,
        coverageNote: "Wereldwijde modelvoorspelling; geen KNMI-officiële waarneming.",
        publishedAt: nearest.time,
        validUntil: hours.at(-1)?.time ?? null,
        locationLabel: input.placeLabel,
        demo: false,
        value: {
          temperatureC: nearest.temperatureC,
          windKmh: nearest.windKmh,
          precipitationProbability: nearest.precipitationProbability,
          hours,
        },
        message: "Weer-uurdata ontvangen via Open-Meteo.",
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
