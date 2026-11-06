"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SportIcon } from "@/components/sport-icon";
import { families, findSport, sports, sportsInFamily } from "@/lib/sports";

function scrollOptionIntoView(list: HTMLElement, option: HTMLElement) {
  const listRect = list.getBoundingClientRect();
  const optionRect = option.getBoundingClientRect();
  if (optionRect.top < listRect.top) {
    list.scrollTop -= listRect.top - optionRect.top;
  } else if (optionRect.bottom > listRect.bottom) {
    list.scrollTop += optionRect.bottom - listRect.bottom;
  }
}

type SportSelectProps = {
  id?: string;
  labelId?: string;
  value: string;
  onChange: (sportId: string) => void;
};

export function SportSelect({ id, labelId, value, onChange }: SportSelectProps) {
  const selected = findSport(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollTargetRef = useRef<string | null>(null);
  const listId = useId();
  const generatedButtonId = useId();
  const buttonId = id ?? generatedButtonId;
  const valueId = `${buttonId}-value`;

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

  useEffect(() => {
    if (!open) return;
    const sportId = scrollTargetRef.current;
    const list = listRef.current;
    if (!sportId || !list) return;
    const option = document.getElementById(`${listId}-option-${sportId}`);
    if (option) scrollOptionIntoView(list, option);
  }, [open, listId]);

  function scrollIndexIntoView(index: number) {
    const sport = filtered[index];
    const list = listRef.current;
    if (!sport || !list) return;
    const option = document.getElementById(`${listId}-option-${sport.id}`);
    if (option) scrollOptionIntoView(list, option);
  }

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
      const next = Math.min(activeIndex + 1, Math.max(filtered.length - 1, 0));
      setActiveIndex(next);
      scrollIndexIntoView(next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(activeIndex - 1, 0);
      setActiveIndex(next);
      scrollIndexIntoView(next);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[activeIndex]) choose(filtered[activeIndex].id);
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
        aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
        onClick={() => {
          const nextIndex = Math.max(filtered.findIndex((sport) => sport.id === selected.id), 0);
          scrollTargetRef.current = filtered[nextIndex]?.id ?? null;
          setActiveIndex(nextIndex);
          setOpen((current) => !current);
        }}
      >
        <span className="icon-badge">
          <SportIcon src={selected.icon} size={24} />
        </span>
        <span className="sport-select-label" id={valueId}>
          {selected.name}
        </span>
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
            aria-controls={listId}
            aria-activedescendant={
              filtered[activeIndex] ? `${listId}-option-${filtered[activeIndex].id}` : undefined
            }
          />
          <ul id={listId} ref={listRef} className="sport-list" role="listbox" aria-label="Buitensporten">
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
