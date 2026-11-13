"use client";

import { useState } from "react";
import Link from "next/link";

/** "Meld me als het goed wordt" on the result page. */
export function AlertButton({ sportId, placeId, placeLabel }: { sportId: string; placeId: string; placeLabel: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function create() {
    setState("busy");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sportId, placeId, placeLabel }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setState("error");
        setMessage(body.error ?? "De melding kon niet worden aangezet.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Geen verbinding. Probeer het opnieuw.");
    }
  }

  if (state === "done") {
    return (
      <p className="alert-done" role="status">
        Melding staat aan. Je krijgt bericht als er een moment van 80 of hoger aankomt.{" "}
        <Link href="/account/meldingen">Meldingen aanpassen</Link>
      </p>
    );
  }
  return (
    <div className="alert-cta">
      <button className="button button-lime" type="button" disabled={state === "busy"} onClick={() => void create()}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 2.5a4.5 4.5 0 0 0-4.5 4.5v2.6L3 12h12l-1.5-2.4V7A4.5 4.5 0 0 0 9 2.5zM7.2 14.2a1.9 1.9 0 0 0 3.6 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {state === "busy" ? "Aanzetten…" : "Meld me als het goed wordt"}
      </button>
      {state === "error" ? (
        <p className="alerts-notice is-error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
