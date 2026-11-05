"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PrivacyActions() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onDelete() {
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, confirm }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Verwijderen mislukt.");
      return;
    }
    setMessage(typeof data.message === "string" ? data.message : "Account verwijderd.");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="privacy-actions">
      <section className="account-panel" aria-labelledby="export-title">
        <h2 id="export-title">Gegevensexport</h2>
        <p>Download een JSON-export van account, momenten, filters, favorieten, voorkeuren en factuurstatus.</p>
        <a className="button button-lime" href="/api/account/export">
          Download export →
        </a>
      </section>

      <section className="account-panel privacy-danger" aria-labelledby="delete-title">
        <h2 id="delete-title">Account verwijderen</h2>
        <p>
          Dit wist je account, sessies, opgeslagen momenten en billingrecords in deze omgeving. Typ{" "}
          <strong>VERWIJDER</strong> en je wachtwoord om te bevestigen.
        </p>
        <label className="field">
          <span>Bevestiging</span>
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="off"
            placeholder="VERWIJDER"
          />
        </label>
        <label className="field">
          <span>Wachtwoord</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p role="status">{message}</p> : null}
        <button className="button button-dark" type="button" disabled={pending} onClick={onDelete}>
          {pending ? "Bezig…" : "Verwijder account permanent"}
        </button>
      </section>
    </div>
  );
}
