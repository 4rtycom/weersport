"use client";

import { useEffect, useId, useRef, useState } from "react";
import { provinceFromDetail } from "@/lib/place-label";

type Place = { id: string; label: string; detail: string };

type PlaceFieldProps = {
  label: string;
  placeId: string;
  onChange: (next: { label: string; placeId: string; detail?: string }) => void;
  inputId?: string;
  invalid?: boolean;
  describedBy?: string;
  /** Plain bordered field for the sponsor form. The planner keeps the marked field. */
  variant?: "marked" | "plain";
  statusId?: string;
};

export function PlaceField({
  label,
  placeId,
  onChange,
  inputId = "locatie",
  invalid = false,
  describedBy,
  variant = "marked",
  statusId,
}: PlaceFieldProps) {
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const plain = variant === "plain";

  useEffect(() => {
    const needle = label.trim();
    if (placeId || needle.length < 2) {
      setPlaces([]);
      setPhase("idle");
      setStatus("");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setPlaces([]);
    const timer = setTimeout(async () => {
      setPhase("loading");
      setStatus("Plaatsen zoeken…");
      try {
        const response = await fetch(`/api/plaatsen?q=${encodeURIComponent(needle)}`, { signal: controller.signal });
        const data = (await response.json()) as { places?: Place[]; error?: string };
        if (cancelled) return;
        if (!response.ok || data.error) {
          setPlaces([]);
          setPhase("error");
          setStatus(data.error ?? "De Nederlandse plaatscontrole is nu niet bereikbaar.");
          return;
        }
        const next = data.places ?? [];
        setPlaces(next);
        setActive(0);
        setPhase(next.length > 0 ? "ready" : "empty");
        setStatus(next.length > 0 ? "" : "Geen plaatsen gevonden.");
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) return;
        setPlaces([]);
        setPhase("error");
        setStatus("De Nederlandse plaatscontrole is nu niet bereikbaar.");
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [label, placeId, attempt]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function choose(place: Place) {
    onChange({ label: place.label, placeId: place.id, detail: place.detail });
    setOpen(false);
    setPlaces([]);
    setPhase("idle");
    setStatus("");
  }

  return (
    <div className="place-field" ref={rootRef}>
      <div className={plain ? "campaign-place" : "text-field"}>
        {plain ? null : <span aria-hidden="true">⌖</span>}
        <input
          id={inputId}
          name={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-busy={phase === "loading" || undefined}
          value={label}
          autoComplete="off"
          onChange={(event) => {
            onChange({ label: event.target.value, placeId: "", detail: "" });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (!open || places.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => (index + 1) % places.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => (index - 1 + places.length) % places.length);
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              const place = places[active] ?? places[0];
              if (place) choose(place);
            }
          }}
        />
        {plain ? (
          <span className="campaign-chevron" aria-hidden="true">
            ⌄
          </span>
        ) : null}
      </div>
      {open && places.length > 0 ? (
        <ul className="place-list" id={listId} role="listbox">
          {places.map((place, index) => {
            const province = provinceFromDetail(place.detail, place.label);
            const extra = province || (place.detail !== place.label ? place.detail : "");
            return (
              <li key={place.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={place.id === placeId || index === active}
                  className="place-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(place)}
                >
                  <strong>{place.label}</strong>
                  {extra ? <small>{extra}</small> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className={status ? "place-status" : "visually-hidden"} id={statusId} role="status">
        {status}
      </p>
      {phase === "error" ? (
        <button type="button" className="place-retry" onClick={() => setAttempt((value) => value + 1)}>
          Opnieuw proberen
        </button>
      ) : null}
    </div>
  );
}
