"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SportIcon } from "@/components/sport-icon";
import { currentSubscription, disablePush, enablePush, needsHomeScreen, pushSupported } from "@/lib/alerts/push-client";

type AlertItem = {
  id: string;
  sportName: string;
  sportIcon: string;
  placeLabel: string;
  minScore: number;
  days: "any" | "weekend";
  email: boolean;
  push: boolean;
  active: boolean;
  lastNotifiedAt: string | null;
};

const thresholds = [
  { value: 70, label: "Goed (70+)" },
  { value: 80, label: "Heel goed (80+)" },
  { value: 90, label: "Top (90+)" },
];

async function call(method: "PATCH" | "DELETE", body: object) {
  try {
    const response = await fetch("/api/alerts", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return response.ok;
  } catch {
    return false;
  }
}

export function AlertsPanel({
  initialAlerts,
  email,
  emailReady,
  pushReady,
  vapidPublicKey,
}: {
  initialAlerts: AlertItem[];
  email: string;
  emailReady: boolean;
  pushReady: boolean;
  vapidPublicKey: string;
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [pushState, setPushState] = useState<"unknown" | "unsupported" | "homescreen" | "off" | "on">("unknown");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) {
      setPushState(needsHomeScreen() ? "homescreen" : "unsupported");
      return;
    }
    if (needsHomeScreen()) {
      setPushState("homescreen");
      return;
    }
    void currentSubscription().then((subscription) => setPushState(subscription ? "on" : "off"));
  }, []);

  async function patch(id: string, change: Partial<AlertItem>) {
    const previous = alerts;
    setAlerts((list) => list.map((alert) => (alert.id === id ? { ...alert, ...change } : alert)));
    const ok = await call("PATCH", { id, ...change });
    if (!ok) {
      setAlerts(previous);
      setNotice({ text: "Wijziging niet opgeslagen. Probeer het opnieuw.", error: true });
    }
  }

  async function remove(id: string) {
    setBusy(id);
    const ok = await call("DELETE", { id });
    setBusy(null);
    setConfirmDelete(null);
    if (ok) setAlerts((list) => list.filter((alert) => alert.id !== id));
    else setNotice({ text: "Verwijderen is niet gelukt.", error: true });
  }

  async function togglePush() {
    setBusy("push");
    setNotice(null);
    if (pushState === "on") {
      await disablePush();
      setPushState("off");
      setNotice({ text: "Pushberichten staan uit op dit apparaat.", error: false });
    } else {
      const result = await enablePush(vapidPublicKey);
      if (result.ok) {
        setPushState("on");
        setAlerts((list) => list.map((alert) => ({ ...alert, push: true })));
        setNotice({ text: "Pushberichten staan aan op dit apparaat.", error: false });
      } else setNotice({ text: result.error, error: true });
    }
    setBusy(null);
  }

  async function test(channel: "email" | "push") {
    setBusy(`test-${channel}`);
    setNotice(null);
    try {
      const response = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      setNotice({ text: body.message ?? body.error ?? "Onbekend resultaat.", error: !response.ok });
    } catch {
      setNotice({ text: "Geen verbinding. Probeer het opnieuw.", error: true });
    }
    setBusy(null);
  }

  return (
    <>
      <section className="account-panel alerts-channels" aria-labelledby="kanalen-titel">
        <h2 id="kanalen-titel">Hoe wil je het horen?</h2>
        <div className="channel-row">
          <div>
            <strong>E-mail</strong>
            <span>{emailReady ? `Naar ${email}` : "Nog niet beschikbaar: e-mail wordt op de server ingesteld."}</span>
          </div>
          {emailReady ? (
            <button className="button button-ghost" type="button" disabled={busy !== null} onClick={() => void test("email")}>
              {busy === "test-email" ? "Versturen…" : "Stuur testmail"}
            </button>
          ) : null}
        </div>
        <div className="channel-row">
          <div>
            <strong>Pushbericht op dit apparaat</strong>
            <span>
              {!pushReady
                ? "Nog niet beschikbaar: pushberichten worden op de server ingesteld."
                : pushState === "on"
                  ? "Staat aan."
                  : pushState === "homescreen"
                    ? "Op iPhone en iPad: voeg WeerSport eerst toe aan je beginscherm (Deel → Zet op beginscherm) en open het daarvandaan."
                    : pushState === "unsupported"
                      ? "Deze browser ondersteunt geen pushberichten."
                      : "Staat uit."}
            </span>
          </div>
          {pushReady && (pushState === "on" || pushState === "off") ? (
            <span className="channel-actions">
              <button
                className={`button ${pushState === "on" ? "button-ghost" : "button-lime"}`}
                type="button"
                disabled={busy !== null}
                onClick={() => void togglePush()}
              >
                {busy === "push" ? "Bezig…" : pushState === "on" ? "Zet push uit" : "Zet push aan"}
              </button>
              {pushState === "on" ? (
                <button className="button button-ghost" type="button" disabled={busy !== null} onClick={() => void test("push")}>
                  {busy === "test-push" ? "Versturen…" : "Stuur testbericht"}
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
        {notice ? (
          <p className={notice.error ? "alerts-notice is-error" : "alerts-notice"} role="status">
            {notice.text}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="mijn-meldingen">
        <h2 className="account-section-title" id="mijn-meldingen">
          Mijn meldingen
        </h2>
        {alerts.length === 0 ? (
          <div className="account-panel">
            <p>
              Je hebt nog geen meldingen. Open een sportmoment en kies <strong>Meld me als het goed wordt</strong>.
            </p>
            <Link className="button button-lime" href="/#planner">
              Zoek een sportmoment
            </Link>
          </div>
        ) : (
          <ul className="account-card-grid">
            {alerts.map((alert) => (
              <li key={alert.id} className={`account-item-card alert-card${alert.active ? "" : " is-paused"}`}>
                <div className="account-item-head">
                  <span className="icon-badge icon-badge-lg">
                    <SportIcon src={alert.sportIcon} size={28} />
                  </span>
                  <div>
                    <h3>
                      {alert.sportName} in {alert.placeLabel}
                    </h3>
                    <p>{alert.active ? "Actief" : "Gepauzeerd"}</p>
                  </div>
                </div>
                <label className="alert-field">
                  <span>Laat het me weten bij</span>
                  <select value={alert.minScore} onChange={(event) => void patch(alert.id, { minScore: Number(event.target.value) })}>
                    {thresholds.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="alert-segment">
                  <legend>Welke dagen</legend>
                  <label>
                    <input type="radio" name={`dagen-${alert.id}`} checked={alert.days === "any"} onChange={() => void patch(alert.id, { days: "any" })} />
                    Elke dag
                  </label>
                  <label>
                    <input type="radio" name={`dagen-${alert.id}`} checked={alert.days === "weekend"} onChange={() => void patch(alert.id, { days: "weekend" })} />
                    Alleen weekend
                  </label>
                </fieldset>
                <div className="alert-toggles">
                  <label>
                    <input type="checkbox" checked={alert.email} onChange={(event) => void patch(alert.id, { email: event.target.checked })} />
                    E-mail
                  </label>
                  <label>
                    <input type="checkbox" checked={alert.push} onChange={(event) => void patch(alert.id, { push: event.target.checked })} />
                    Push
                  </label>
                </div>
                <div className="account-item-actions">
                  <button className="button button-ghost" type="button" onClick={() => void patch(alert.id, { active: !alert.active })}>
                    {alert.active ? "Pauzeer" : "Hervat"}
                  </button>
                  {confirmDelete === alert.id ? (
                    <span className="confirm-delete">
                      <button className="button button-danger-solid" type="button" disabled={busy === alert.id} autoFocus onClick={() => void remove(alert.id)}>
                        {busy === alert.id ? "Verwijderen…" : "Ja, verwijder"}
                      </button>
                      <button className="button button-ghost" type="button" onClick={() => setConfirmDelete(null)}>
                        Annuleer
                      </button>
                    </span>
                  ) : (
                    <button className="button button-ghost button-danger" type="button" onClick={() => setConfirmDelete(alert.id)}>
                      Verwijder
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
