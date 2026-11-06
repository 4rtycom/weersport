"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchDraft } from "@/lib/draft";

export function StartAnalysis({
  draft,
  entitlement,
  quotaExhausted = false,
}: {
  draft: SearchDraft;
  entitlement: { used: number; limit: number; remaining: number; plan: string; resetAt: string };
  quotaExhausted?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setPending(true);
    setError("");
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `moment-${Date.now()}`;
    const response = await fetch("/api/moment", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(draft),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; snapshot?: unknown };
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Analyse starten mislukt.");
      return;
    }
    // POST wrote cache (scored or safety-only). Refresh uses read-only peek.
    router.refresh();
  }

  return (
    <main className="moment" id="inhoud">
      <p className="eyebrow">Analyse</p>
      <h1>Start je WeerSport-analyse</h1>
      <p>
        {draft.sportId} · {draft.placeLabel} · {draft.period}
      </p>
      <p>
        {entitlement.plan === "pro" ? "Pro" : "Basis"} {entitlement.used}/{entitlement.limit} deze maand.
        Refreshen of terugkeren naar een opgeslagen resultaat kost geen extra analyse.
      </p>
      {quotaExhausted ? (
        <p role="status">
          Je quotum is op. Je kunt nog wel veiligheid en UV laden zonder nieuwe score. Reset: {entitlement.resetAt}.
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button button-lime" type="button" onClick={start} disabled={pending}>
        {pending ? "Bezig…" : quotaExhausted ? "Toon veiligheid & UV" : "Start analyse"}
      </button>
    </main>
  );
}
