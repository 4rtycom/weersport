export type ProviderId = "knmi" | "rws" | "pdok" | "luchtmeetnet";

export type ProviderErrorCode =
  | "FLAG_OFF"
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "UPSTREAM"
  | "SCHEMA"
  | "EMPTY"
  | "CIRCUIT_OPEN";

export type ProviderRights = {
  license: string;
  attribution: string;
  sourceUrl: string;
};

export const PROVIDER_RIGHTS: Record<ProviderId, ProviderRights> = {
  knmi: {
    license: "CC BY 4.0",
    attribution: "KNMI",
    sourceUrl: "https://dataplatform.knmi.nl/dataset/knmi-public-weather-warnings-1-0",
  },
  rws: {
    license: "CC0",
    attribution: "Rijkswaterstaat",
    sourceUrl: "https://rwsdata.nl/waterdata/",
  },
  pdok: {
    license: "Per achterliggende PDOK-dataset",
    attribution: "PDOK / Kadaster",
    sourceUrl: "https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/",
  },
  luchtmeetnet: {
    license: "Open API; hergebruikvoorwaarden controleren vóór publieke uitrol",
    attribution: "Luchtmeetnet",
    sourceUrl: "https://www.luchtmeetnet.nl/informatie/download-data/open-data",
  },
};

export type CoverageKind = "EXACT" | "REPRESENTATIVE" | "REGIONAL" | "NONE";
