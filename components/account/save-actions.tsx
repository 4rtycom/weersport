"use client";

import { useState } from "react";

type Props = {
  sportId: string;
  placeId: string;
  placeLabel: string;
  period: string;
  peakLabel?: string | null;
  snapshotAt?: string | null;
  scoreLabel?: string | null;
  modelVersion?: string | null;
  spotId?: string | null;
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
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const response = await fetch("/api/moments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sportId: props.sportId,
        placeId: props.placeId,
        placeLabel: props.placeLabel,
        period: props.period,
        windowLabel: props.peakLabel ?? "Gepland tijdvak",
        plannedStart: start.toISOString(),
        plannedEnd: end.toISOString(),
        lastSnapshotAt: props.snapshotAt ?? null,
        lastScoreLabel: props.scoreLabel ?? null,
        modelVersion: props.modelVersion ?? null,
        spotId: props.spotId ?? null,
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
