"use client";

import { useEffect, useId, useRef, useState } from "react";

type Place = { id: string; label: string; detail: string };

type PlaceFieldProps = {
  label: string;
  placeId: string;
  onChange: (next: { label: string; placeId: string }) => void;
};

export function PlaceField({ label, placeId, onChange }: PlaceFieldProps) {
  const [open, setOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const needle = label.trim();
    if (needle.length < 2) {
      setPlaces([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/plaatsen?q=${encodeURIComponent(needle)}`);
        const data = (await response.json()) as { places?: Place[]; error?: string };
        setPlaces(data.places ?? []);
        setActive(0);
        setStatus(data.error ?? "");
      } catch {
        setPlaces([]);
        setStatus("De Nederlandse plaatscontrole is nu niet bereikbaar.");
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [label]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function choose(place: Place) {
    onChange({ label: place.label, placeId: place.id });
    setOpen(false);
  }

  return (
    <div className="place-field" ref={rootRef}>
      <div className="text-field">
        <span aria-hidden="true">⌖</span>
        <input
          id="locatie"
          name="locatie"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={label}
          autoComplete="off"
          onChange={(event) => {
            onChange({ label: event.target.value, placeId: "" });
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
              choose(places[active] ?? places[0]);
            }
          }}
        />
      </div>
      {open && places.length > 0 ? (
        <ul className="place-list" id={listId} role="listbox">
          {places.map((place, index) => (
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
                <small>{place.detail}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {status ? <p className="place-status">{status}</p> : null}
    </div>
  );
}
