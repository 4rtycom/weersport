"use client";

import { useState } from "react";

type Props = {
  sportId: string;
  placeId: string;
  placeLabel: string;
  period: string;
  peakLabel?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  snapshotAt?: string | null;
  scoreLabel?: string | null;
};

export function SaveActions(props: Props) {
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"search" | "plan" | null>(null);

  async function saveSearch() {
    setPending("search");
    setNotice("");
    const response = await fetch("/api/searches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sportId: props.sportId,
        placeId: props.placeId,
        placeLabel: props.placeLabel,
        period: props.period,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; booked?: boolean; consumed?: number };
    setPending(null);
    if (!response.ok || data.booked !== false || data.consumed !== 0) {
      setNotice(data.error ?? "Zoekopdracht is niet opgeslagen.");
      return;
    }
    setNotice("Zoekfilters opgeslagen · 0 aanvragen verbruikt.");
  }

  async function savePlan() {
    setPending("plan");
    setNotice("");
    const plannedStart = props.plannedStart ?? "";
    const plannedEnd = props.plannedEnd ?? "";
    if (!plannedStart || !plannedEnd || Number.isNaN(Date.parse(plannedStart)) || Number.isNaN(Date.parse(plannedEnd))) {
      setPending(null);
      setNotice("Geen aanbevolen tijdvak om op te slaan.");
      return;
    }
    const response = await fetch("/api/moments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sportId: props.sportId,
        placeId: props.placeId,
        placeLabel: props.placeLabel,
        period: props.period,
        windowLabel: props.peakLabel ?? "Gepland tijdvak",
        plannedStart,
        plannedEnd,
        lastSnapshotAt: props.snapshotAt ?? null,
        lastScoreLabel: props.scoreLabel ?? null,
        note: "Opgeslagen plan, geen live weersadvies of veiligheidsgarantie.",
      }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; booked?: boolean; consumed?: number };
    setPending(null);
    if (!response.ok || data.booked !== false || data.consumed !== 0) {
      setNotice(data.error ?? "Sportmoment is niet opgeslagen.");
      return;
    }
    setNotice("Sportmoment opgeslagen · 0 aanvragen verbruikt.");
  }

  return (
    <div className="save-actions">
      <button className="button button-dark" type="button" disabled={pending !== null} onClick={savePlan}>
        {pending === "plan" ? "Opslaan…" : "Bewaar sportmoment"}
      </button>
      <button className="button button-lime" type="button" disabled={pending !== null} onClick={saveSearch}>
        {pending === "search" ? "Opslaan…" : "Bewaar zoekfilters"}
      </button>
      {notice ? <p className="save-actions-note">{notice}</p> : null}
    </div>
  );
}
