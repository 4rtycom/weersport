import type { ProviderId } from "@/lib/data/providers/contracts";
import { dataFlagSnapshot } from "@/lib/data/flags";
import { knmiKeyConfigured } from "@/lib/data/knmi/key";

export type ProviderHealth = {
  provider: ProviderId | "persistence";
  status: string;
  lastSuccessAt: string | null;
  lastPublishedAt: string | null;
  lastErrorCode: string | null;
  records: number;
  requests: number;
  latencyMs: number | null;
  note: string;
};

const rows = new Map<string, ProviderHealth>();

export function recordProviderHealth(row: ProviderHealth) {
  rows.set(row.provider, row);
}

export function providerHealthRows(): ProviderHealth[] {
  return [...rows.values()];
}

export function dataSourceStatus() {
  return {
    flags: dataFlagSnapshot(),
    knmiKeyConfigured: knmiKeyConfigured(),
    persistence: "process-memory",
    // Fase 03: this process cache is not durable. Do not treat SQL tables as live storage until the runtime reads them.
    durableStore: "not-applied",
    providers: providerHealthRows(),
  };
}

export function resetProviderHealthForTests() {
  rows.clear();
}
