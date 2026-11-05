"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SportIcon } from "@/components/sport-icon";
import { families, findSport, sports, sportsInFamily } from "@/lib/sports";

type SportSelectProps = {
  value: string;
  onChange: (sportId: string) => void;
};

export function SportSelect({ value, onChange }: SportSelectProps) {
  const selected = findSport(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const buttonId = useId();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sports;
    return sports.filter((sport) => sport.name.toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function choose(sportId: string) {
    onChange(sportId);
    setOpen(false);
    setQuery("");
    document.getElementById(buttonId)?.focus();
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      document.getElementById(buttonId)?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex].id);
    }
  }

  const groups = families
    .map((family) => ({
      family,
      items: sportsInFamily(family.id).filter((sport) => filtered.some((item) => item.id === sport.id)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="sport-select" ref={rootRef}>
      <button
        id={buttonId}
        className="sport-select-button"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((current) => !current);
          setActiveIndex(Math.max(filtered.findIndex((sport) => sport.id === selected.id), 0));
        }}
      >
        <span className="icon-badge">
          <SportIcon src={selected.icon} size={24} />
        </span>
        <span className="sport-select-label">{selected.name}</span>
        <span className="chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open ? (
        <div className="sport-popover">
          <label className="visually-hidden" htmlFor={`${listId}-search`}>
            Zoek een buitensport
          </label>
          <input
            id={`${listId}-search`}
            ref={searchRef}
            className="sport-search"
            value={query}
            placeholder="Zoek een sport"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onSearchKey}
            autoComplete="off"
          />
          <ul id={listId} className="sport-list" role="listbox" aria-label="Buitensporten">
            {groups.map((group) => (
              <li key={group.family.id}>
                <p className="sport-group" id={`${listId}-${group.family.id}`}>
                  {group.family.name}
                </p>
                <ul>
                  {group.items.map((sport) => {
                    const index = filtered.findIndex((item) => item.id === sport.id);
                    const active = index === activeIndex;
                    return (
                      <li key={sport.id}>
                        <button
                          type="button"
                          role="option"
                          id={`${listId}-option-${sport.id}`}
                          aria-selected={sport.id === selected.id}
                          className={active ? "sport-option is-active" : "sport-option"}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => choose(sport.id)}
                        >
                          <SportIcon src={sport.icon} size={22} />
                          <span>{sport.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {filtered.length === 0 ? <li className="sport-empty">Geen sport met die naam.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
