import type { ProviderId } from "@/lib/data/providers/contracts";

type Breaker = { failures: number; openUntil: number };

const breakers = new Map<ProviderId, Breaker>();

export type ProviderHttpResult =
  | { ok: true; status: number; text: string; json: unknown }
  | { ok: false; code: "TIMEOUT" | "RATE_LIMITED" | "UPSTREAM" | "UNAUTHORIZED" | "CIRCUIT_OPEN"; status: number | null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function breakerOpen(provider: ProviderId) {
  const row = breakers.get(provider);
  return Boolean(row && row.openUntil > Date.now());
}

function recordSuccess(provider: ProviderId) {
  breakers.set(provider, { failures: 0, openUntil: 0 });
}

function recordFailure(provider: ProviderId) {
  const row = breakers.get(provider) ?? { failures: 0, openUntil: 0 };
  const failures = row.failures + 1;
  breakers.set(provider, {
    failures,
    openUntil: failures >= 3 ? Date.now() + 60_000 : 0,
  });
}

export function resetProviderHttpForTests() {
  breakers.clear();
}

export async function providerRequest(input: {
  provider: ProviderId;
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  retries?: number;
}): Promise<ProviderHttpResult> {
  if (breakerOpen(input.provider)) return { ok: false, code: "CIRCUIT_OPEN", status: null };
  const retries = input.retries ?? 2;
  const timeoutMs = input.timeoutMs ?? 10_000;
  let last: ProviderHttpResult = { ok: false, code: "UPSTREAM", status: null };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input.url, {
        ...input.init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      if (response.status === 429 || response.status >= 500) {
        last = { ok: false, code: response.status === 429 ? "RATE_LIMITED" : "UPSTREAM", status: response.status };
        if (attempt < retries) {
          const jitter = Math.floor(Math.random() * 150);
          await sleep(200 * 2 ** attempt + jitter);
          continue;
        }
        break;
      }
      if (!response.ok) {
        recordFailure(input.provider);
        return { ok: false, code: response.status === 401 || response.status === 403 ? "UNAUTHORIZED" : "UPSTREAM", status: response.status };
      }
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          json = null;
        }
      }
      recordSuccess(input.provider);
      return { ok: true, status: response.status, text, json };
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      last = { ok: false, code: timedOut ? "TIMEOUT" : "UPSTREAM", status: null };
      if (attempt < retries && timedOut) {
        await sleep(200 * 2 ** attempt);
        continue;
      }
      break;
    }
  }
  recordFailure(input.provider);
  return last;
}
