"use client";

import { useState } from "react";
import styles from "@/app/sponsoring/signup.module.css";

type View = {
  profile: { public_name: string; moderation_status: string; moderation_reason: string | null; destination_url: string };
  billing: { invoice_email: string } | null;
  contract: { status: string; paid_until: string | null; cancel_effective_at: string | null; rate_cents: number } | null;
  sports: string[];
  invoices: Array<{ id: string; period_start: string; status: string; gross_cents: number; invoice_number: string | null }>;
};

const MODERATION: Record<string, string> = {
  pending: "Wacht op controle",
  approved: "Goedgekeurd en zichtbaar",
  rejected: "Afgewezen",
  paused: "Gepauzeerd",
};
const CONTRACT: Record<string, string> = {
  pending: "Wacht op eerste betaling",
  scheduled: "Gepland",
  active: "Actief",
  cancel_scheduled: "Opgezegd per einde periode",
  paused: "Gepauzeerd",
  ended: "Beëindigd",
  canceled: "Beëindigd",
};
const INVOICE: Record<string, string> = {
  draft: "In voorbereiding",
  issuing: "Wordt aangemaakt",
  open: "Open",
  collection_pending: "Incasso loopt",
  paid: "Betaald",
  failed: "Niet betaald",
  refunded: "Terugbetaald",
};

function euros(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}€ ${Math.floor(abs / 100).toLocaleString("nl-NL")},${String(abs % 100).padStart(2, "0")}`;
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(parsed);
}

export function ManagePanel({ token, view }: { token: string; view: View }) {
  const [email, setEmail] = useState(view.billing?.invoice_email ?? "");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setPending(action);
    setMessage("");
    try {
      const response = await fetch("/api/sponsoring/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action, ...extra }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        grossCents?: number;
        appliesFrom?: string;
      };
      setIsError(Boolean(body.error) || !response.ok);
      setMessage(
        body.error ??
          (body.appliesFrom && typeof body.grossCents === "number"
            ? `Vanaf ${date(body.appliesFrom)} betaal je ${euros(body.grossCents)} per maand.`
            : action === "cancel"
              ? "Opgezegd. Je vermelding blijft zichtbaar tot het einde van de betaalde periode."
              : "Opgeslagen."),
      );
    } catch {
      setIsError(true);
      setMessage("Geen verbinding. Probeer het opnieuw.");
    } finally {
      setPending(null);
      setConfirmCancel(false);
    }
  }

  const contract = view.contract;
  return (
    <>
      <section className={styles.card} aria-labelledby="vermelding">
        <h2 id="vermelding">{view.profile.public_name}</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Vermelding</dt>
            <dd>
              {MODERATION[view.profile.moderation_status] ?? view.profile.moderation_status}
              {view.profile.moderation_reason ? <small>{view.profile.moderation_reason}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Contract</dt>
            <dd>
              {contract ? (CONTRACT[contract.status] ?? contract.status) : "Geen contract"}
              {contract?.paid_until ? <small>Betaald tot {date(contract.paid_until)}</small> : null}
            </dd>
          </div>
          {contract ? (
            <div>
              <dt>Maandbedrag</dt>
              <dd>{euros(contract.rate_cents)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Sporten</dt>
            <dd>{view.sports.join(", ") || "Geen"}</dd>
          </div>
        </dl>
      </section>

      {view.invoices.length > 0 ? (
        <section className={styles.card} aria-labelledby="facturen">
          <h2 id="facturen">Facturen</h2>
          <ul className={styles.invoiceList}>
            {view.invoices.map((invoice) => (
              <li key={invoice.id}>
                <span>
                  <strong>{date(invoice.period_start)}</strong>
                  <small>{invoice.invoice_number ?? "Nog geen factuurnummer"}</small>
                </span>
                <span className={styles.invoiceStatus}>{INVOICE[invoice.status] ?? invoice.status}</span>
                <span className={styles.invoiceAmount}>{euros(invoice.gross_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.card} aria-labelledby="wijzigen">
        <h2 id="wijzigen">Wijzigen</h2>
        <div className={styles.grid}>
          <label>
            Factuur-e-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
        </div>
        <div className={styles.actions}>
          <button className="button button-dark" type="button" disabled={pending !== null} onClick={() => void post("email", { email })}>
            {pending === "email" ? "Opslaan…" : "E-mail opslaan"}
          </button>
          <button className="button button-ghost" type="button" disabled={pending !== null} onClick={() => void post("selection", { sportIds: view.sports })}>
            {pending === "selection" ? "Berekenen…" : "Bereken volgende maandbedrag"}
          </button>
        </div>
        {message ? (
          <p className={isError ? styles.error : styles.note} role="status">
            {message}
          </p>
        ) : null}
      </section>

      <section className={`${styles.card} ${styles.danger}`} aria-labelledby="opzeggen">
        <h2 id="opzeggen">Opzeggen</h2>
        <p className={styles.help}>Je vermelding blijft zichtbaar tot het einde van de periode die je al hebt betaald.</p>
        <div className={styles.actions}>
          {confirmCancel ? (
            <>
              <button className="button button-danger-solid" type="button" disabled={pending !== null} autoFocus onClick={() => void post("cancel")}>
                {pending === "cancel" ? "Opzeggen…" : "Ja, zeg op"}
              </button>
              <button className="button button-ghost" type="button" disabled={pending !== null} onClick={() => setConfirmCancel(false)}>
                Annuleer
              </button>
            </>
          ) : (
            <button className="button button-ghost button-danger" type="button" onClick={() => setConfirmCancel(true)}>
              Sponsoring opzeggen
            </button>
          )}
        </div>
      </section>
    </>
  );
}
