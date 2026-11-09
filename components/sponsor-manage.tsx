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

export function ManagePanel({ token, view }: { token: string; view: View }) {
  const [email, setEmail] = useState(view.billing?.invoice_email ?? "");
  const [message, setMessage] = useState("");

  async function post(action: string, extra: Record<string, unknown> = {}) {
    const response = await fetch("/api/sponsoring/manage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, action, ...extra }),
    });
    const body = (await response.json()) as { error?: string; ok?: boolean; grossCents?: number; appliesFrom?: string };
    setMessage(body.error ?? (body.appliesFrom ? `Volgende periode vanaf ${body.appliesFrom}: ${body.grossCents} cent.` : "Opgeslagen."));
  }

  return (
    <section className={styles.card}>
      <h2>{view.profile.public_name}</h2>
      <p>Status publicatie: {view.profile.moderation_status}{view.profile.moderation_reason ? ` — ${view.profile.moderation_reason}` : ""}</p>
      <p>Contract: {view.contract?.status ?? "geen"} tot {view.contract?.paid_until ?? "—"}</p>
      <p>Huidige sporten: {view.sports.join(", ") || "geen"}</p>
      <ul>
        {view.invoices.map((invoice) => (
          <li key={invoice.id}>{invoice.period_start}: {invoice.status}, {invoice.invoice_number ?? "zonder nummer"}</li>
        ))}
      </ul>
      <label>
        Factuur-e-mail
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <div className={styles.actions}>
        <button className="button button-dark" type="button" onClick={() => void post("email", { email })}>E-mail wijzigen</button>
        <button className="button button-dark" type="button" onClick={() => void post("selection", { sportIds: view.sports })}>Volgende prijs controleren</button>
        <button className="button button-lime" type="button" onClick={() => void post("cancel")}>Opzeggen</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
