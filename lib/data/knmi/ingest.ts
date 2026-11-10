import { DATA_FLAG, dataFlagEnabled } from "@/lib/data/flags";
import { pointInGeometry } from "@/lib/data/knmi/geometry";
import { readKnmiKey } from "@/lib/data/knmi/key";
import { parseKnmiSnapshot, partsOverlapping, phenomenonLabel, type ParsedKnmiSnapshot } from "@/lib/data/knmi/parse";
import { recordProviderHealth } from "@/lib/data/providers/health";
import { providerRequest } from "@/lib/data/providers/http";
import { hashPayload, readKnmiStore, writeKnmiStore, type StoredKnmi } from "@/lib/data/storage/memory";
import type { SourceStatus } from "@/lib/data/types";

const DATASET = "https://api.dataplatform.knmi.nl/open-data/v1/datasets/KNMI-public-weather-warnings/versions/1.0";
const FRESH_MS = 26 * 60 * 60 * 1000;
const FILE_NAME = /^public_warnings_(\d{4}-\d{2}-\d{2}T\d{6})\d*Z\.json$/;

export type KnmiMatch = {
  status: SourceStatus;
  publishedAt: string | null;
  fetchedAt: string | null;
  message: string;
  items: Array<{
    title: string;
    detail: string;
    code: "geel" | "oranje" | "rood";
    phenomenon: string;
    validFrom: string;
    validUntil: string;
    attribution: string;
  }>;
};

function filenamesFrom(payload: unknown): { names: string[]; truncated: boolean } {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const result = root.result && typeof root.result === "object" ? (root.result as Record<string, unknown>) : null;
  const list = Array.isArray(root.files) ? root.files : Array.isArray(result?.files) ? result.files : Array.isArray(root.result) ? root.result : [];
  const names = list
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object" && typeof (entry as { filename?: unknown }).filename === "string") {
        return (entry as { filename: string }).filename;
      }
      return null;
    })
    .filter((name): name is string => Boolean(name));
  const truncated = root.isTruncated === true || result?.isTruncated === true || typeof root.nextPageToken === "string";
  return { names, truncated };
}

function newestJson(names: string[]) {
  const ranked = names
    .map((name) => {
      const base = name.split("/").pop() ?? name;
      const match = FILE_NAME.exec(base);
      if (!match) return null;
      const stamp = `${match[1].slice(0, 13)}:${match[1].slice(13, 15)}:${match[1].slice(15, 17)}Z`;
      const millis = new Date(stamp).getTime();
      if (Number.isNaN(millis) || millis < Date.parse("2026-11-02T00:00:00Z")) return null;
      return { name, millis };
    })
    .filter((row): row is { name: string; millis: number } => row !== null)
    .sort((a, b) => b.millis - a.millis);
  return ranked[0]?.name ?? null;
}

function downloadUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const nested = record.result && typeof record.result === "object" ? (record.result as Record<string, unknown>) : null;
  const value = record.temporaryDownloadUrl ?? record.url ?? nested?.temporaryDownloadUrl ?? nested?.url;
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

function remember(filename: string, raw: string, snapshot: ParsedKnmiSnapshot, replaced: boolean) {
  const fetchedAt = new Date().toISOString();
  const stored: StoredKnmi = { hash: hashPayload(raw), filename, fetchedAt, snapshot };
  if (!snapshot.rejectedAsTest) writeKnmiStore(stored);
  recordProviderHealth({
    provider: "knmi",
    status: snapshot.rejectedAsTest ? "TEST_ONLY" : "READY",
    lastSuccessAt: snapshot.rejectedAsTest ? null : fetchedAt,
    lastPublishedAt: snapshot.generatedAt,
    lastErrorCode: snapshot.rejectedAsTest ? "TEST_ONLY" : null,
    records: snapshot.parts.length,
    requests: 2,
    latencyMs: null,
    note: replaced ? `Snapshot ${filename} vervangt de vorige.` : `Snapshot ${filename} ongewijzigd.`,
  });
  return stored;
}

export async function ingestKnmiSnapshot(): Promise<{ ok: true; filename: string; records: number } | { ok: false; code: string; message: string }> {
  if (!dataFlagEnabled(DATA_FLAG.knmi)) {
    return { ok: false, code: "FLAG_OFF", message: "KNMI-flag staat uit." };
  }
  const key = readKnmiKey();
  if (!key) {
    recordProviderHealth({
      provider: "knmi",
      status: "NOT_LINKED",
      lastSuccessAt: null,
      lastPublishedAt: null,
      lastErrorCode: "NOT_CONFIGURED",
      records: 0,
      requests: 0,
      latencyMs: null,
      note: "Geen bruikbare KNMI-sleutel.",
    });
    return { ok: false, code: "NOT_CONFIGURED", message: "KNMI-sleutel ontbreekt." };
  }
  const started = Date.now();
  const list = await providerRequest({
    provider: "knmi",
    url: `${DATASET}/files?maxKeys=20&sorting=desc&orderBy=filename`,
    init: { headers: { Authorization: key } },
  });
  if (!list.ok) {
    recordProviderHealth({
      provider: "knmi",
      status: "ERROR",
      lastSuccessAt: readKnmiStore()?.fetchedAt ?? null,
      lastPublishedAt: readKnmiStore()?.snapshot.generatedAt ?? null,
      lastErrorCode: list.code,
      records: 0,
      requests: 1,
      latencyMs: Date.now() - started,
      note: "Bestandenlijst niet bereikbaar.",
    });
    return { ok: false, code: list.code, message: `KNMI-bestandenlijst is niet bereikbaar (${list.code}).` };
  }
  const filename = newestJson(filenamesFrom(list.json).names);
  if (!filename) return { ok: false, code: "SCHEMA", message: "Geen actueel public_warnings JSON-bestand." };
  const link = await providerRequest({
    provider: "knmi",
    url: `${DATASET}/files/${encodeURIComponent(filename)}/url`,
    init: { headers: { Authorization: key } },
  });
  if (!link.ok) return { ok: false, code: link.code, message: "KNMI-downloadlink is niet bereikbaar." };
  const temporary = downloadUrl(link.json);
  if (!temporary) return { ok: false, code: "SCHEMA", message: "KNMI-downloadlink mist een URL." };
  const file = await providerRequest({ provider: "knmi", url: temporary, init: { headers: {} } });
  if (!file.ok || file.json === null) return { ok: false, code: file.ok ? "SCHEMA" : file.code, message: "KNMI-snapshot is niet leesbaar." };
  const parsed = parseKnmiSnapshot(file.json);
  if (!parsed.ok) return { ok: false, code: parsed.code, message: parsed.message };
  const previous = readKnmiStore();
  const hash = hashPayload(file.text);
  remember(filename, file.text, parsed.snapshot, previous?.hash !== hash);
  return { ok: true, filename, records: parsed.snapshot.parts.length };
}

export function matchKnmiWarnings(input: { latitude: number; longitude: number; from: Date; until: Date }): KnmiMatch {
  const stored = readKnmiStore();
  if (!dataFlagEnabled(DATA_FLAG.knmi) || !stored || stored.snapshot.rejectedAsTest) {
    return {
      status: "NOT_LINKED",
      publishedAt: null,
      fetchedAt: null,
      message: "Bron niet gekoppeld / geen veiligheidsoordeel",
      items: [],
    };
  }
  const age = Date.now() - new Date(stored.snapshot.generatedAt).getTime();
  const stale = Number.isNaN(age) || age > FRESH_MS;
  const hits = partsOverlapping(stored.snapshot.parts, input.from, input.until).filter((part) =>
    pointInGeometry(input.longitude, input.latitude, part.geometry),
  );
  if (stale) {
    return {
      status: "STALE",
      publishedAt: stored.snapshot.generatedAt,
      fetchedAt: stored.fetchedAt,
      message: "KNMI-snapshot is verouderd. Dit is geen actueel veiligheidsoordeel.",
      items: hits.map(toItem),
    };
  }
  if (hits.length === 0) {
    return {
      status: "READY",
      publishedAt: stored.snapshot.generatedAt,
      fetchedAt: stored.fetchedAt,
      message: stored.snapshot.emptyOperational
        ? "Geen actuele waarschuwing in deze geldige operationele snapshot."
        : "Geen actuele waarschuwing voor deze locatie in het gekozen tijdvak.",
      items: [],
    };
  }
  return {
    status: "OFFICIAL_WARNING",
    publishedAt: stored.snapshot.generatedAt,
    fetchedAt: stored.fetchedAt,
    message: "Officiële KNMI-waarschuwing voor deze locatie en dit tijdvak.",
    items: hits.map(toItem),
  };
}

function toItem(part: ParsedKnmiSnapshot["parts"][number]) {
  return {
    title: `${part.color} · ${part.headline}`,
    detail: part.description || phenomenonLabel(part.phenomenon),
    code: part.color,
    phenomenon: phenomenonLabel(part.phenomenon),
    validFrom: part.onset,
    validUntil: part.expires,
    attribution: "KNMI, CC BY 4.0",
  };
}
