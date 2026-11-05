"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteMomentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    await fetch("/api/moments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button className="button button-dark" type="button" disabled={pending} onClick={onDelete}>
      {pending ? "Verwijderen…" : "Verwijder plan"}
    </button>
  );
}

export function OpenMomentButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  async function onOpen() {
    setPending(true);
    const response = await fetch("/api/moments", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await response.json().catch(() => ({}))) as { next?: string };
    if (data.next) {
      window.location.assign(data.next);
      return;
    }
    setPending(false);
  }

  return (
    <button className="button button-lime" type="button" disabled={pending} onClick={onOpen}>
      {pending ? "Openen…" : "Details bekijken →"}
    </button>
  );
}

export function OpenSearchButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  async function onOpen() {
    setPending(true);
    const response = await fetch("/api/searches", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await response.json().catch(() => ({}))) as { next?: string };
    if (data.next) {
      window.location.assign(data.next);
      return;
    }
    setPending(false);
  }

  return (
    <button className="button button-dark" type="button" disabled={pending} onClick={onOpen}>
      {pending ? "Openen…" : "Open zoekopdracht →"}
    </button>
  );
}

export function DeleteSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    await fetch("/api/searches", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button className="button button-lime" type="button" disabled={pending} onClick={onDelete}>
      {pending ? "Verwijderen…" : "Verwijder filter"}
    </button>
  );
}

export function FavoriteToggle({ sportId, favorite }: { sportId: string; favorite: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onToggle() {
    setPending(true);
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sportId, favorite: !favorite }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button className={`button ${favorite ? "button-lime" : "button-dark"}`} type="button" disabled={pending} onClick={onToggle}>
      {pending ? "…" : favorite ? "Favoriet" : "Maak favoriet"}
    </button>
  );
}

export function PreferencesForm({
  initial,
}: {
  initial: { weekendFocus: boolean; uvReminders: boolean; savePlansByDefault: boolean };
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json().catch(() => ({}))) as { booked?: boolean; consumed?: number; error?: string };
    setPending(false);
    if (!response.ok || data.booked !== false || data.consumed !== 0) {
      setNotice(data.error ?? "Voorkeuren niet opgeslagen.");
      return;
    }
    setNotice("Voorkeuren opgeslagen · 0 aanvragen.");
    router.refresh();
  }

  return (
    <div className="preference-form">
      <label className="preference-row">
        <input
          type="checkbox"
          checked={values.weekendFocus}
          onChange={(event) => setValues((current) => ({ ...current, weekendFocus: event.target.checked }))}
        />
        <span>
          <strong>Weekendfocus</strong>
          <em>Toon eerst plannen in het weekendvenster.</em>
        </span>
      </label>
      <label className="preference-row">
        <input
          type="checkbox"
          checked={values.uvReminders}
          onChange={(event) => setValues((current) => ({ ...current, uvReminders: event.target.checked }))}
        />
        <span>
          <strong>UV-herinnering</strong>
          <em>UV blijft los van score; dit is alleen een voorkeurstip.</em>
        </span>
      </label>
      <label className="preference-row">
        <input
          type="checkbox"
          checked={values.savePlansByDefault}
          onChange={(event) => setValues((current) => ({ ...current, savePlansByDefault: event.target.checked }))}
        />
        <span>
          <strong>Plan voorstellen na score</strong>
          <em>Suggereer opslaan van een sportmoment na een geladen voorspelling.</em>
        </span>
      </label>
      <button className="button button-dark" type="button" disabled={pending} onClick={onSave}>
        {pending ? "Opslaan…" : "Bewaar voorkeuren"}
      </button>
      {notice ? <p className="save-actions-note">{notice}</p> : null}
    </div>
  );
}
