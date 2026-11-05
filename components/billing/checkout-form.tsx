"use client";

import { useState } from "react";

export function CheckoutForm({ email }: { email: string }) {
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onCheckout() {
    setPending(true);
    setError("");
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consent,
        idempotencyKey: `checkout-${email}-${new Date().toISOString().slice(0, 10)}`,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      checkout?: { checkoutUrl: string };
    };
    setPending(false);
    if (!response.ok || !data.checkout?.checkoutUrl) {
      setError(data.error ?? "Checkout kon niet worden gestart.");
      return;
    }
    window.location.assign(data.checkout.checkoutUrl);
  }

  return (
    <div className="billing-checkout-card">
      <h2>Bevestigen</h2>
      <p>Veilig afrekenen via Mollie. WeerSport bewaart geen ruwe kaart- of bankgegevens.</p>
      <label className="billing-field">
        <span>Factuur-e-mail</span>
        <strong>{email}</strong>
      </label>
      <label className="preference-row">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>
          <strong>Doorlopend abonnement</strong>
          <em>Ik ga akkoord met € 4,95 per maand via Mollie tot ik opzeg.</em>
        </span>
      </label>
      <button className="button button-lime" type="button" disabled={!consent || pending} onClick={onCheckout}>
        {pending ? "Checkout starten…" : "Bevestig Pro-abonnement →"}
      </button>
      {error ? <p className="auth-error">{error}</p> : null}
      <p className="billing-note">Browserredirect is geen betaalbewijs. Pro activeert pas na geverifieerde Mollie-status.</p>
    </div>
  );
}

export function CancelSubscriptionButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function onCancel() {
    setPending(true);
    const response = await fetch("/api/billing/cancel", { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    setPending(false);
    setMessage(data.message ?? data.error ?? "Opzegging niet verwerkt.");
    if (response.ok) window.location.reload();
  }

  return (
    <div>
      <button className="button button-dark" type="button" disabled={pending} onClick={onCancel}>
        {pending ? "Bezig…" : "Zeg Pro op aan einde periode"}
      </button>
      {message ? <p className="save-actions-note">{message}</p> : null}
    </div>
  );
}

export function SimulatePaymentButtons({ checkoutId }: { checkoutId: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function simulate(status: "paid" | "failed" | "canceled") {
    setPending(status);
    setError("");
    const response = await fetch("/api/billing/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkoutId, status }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; next?: string };
    setPending(null);
    if (!response.ok || !data.next) {
      setError(data.error ?? "Simulatie mislukt.");
      return;
    }
    window.location.assign(data.next);
  }

  return (
    <div className="billing-simulate">
      <p className="billing-note">Lokale Mollie-sandbox: bevestig via server-side verificatie (geen redirect-trust).</p>
      <div className="account-item-actions">
        <button className="button button-lime" type="button" disabled={pending !== null} onClick={() => simulate("paid")}>
          {pending === "paid" ? "…" : "Simuleer betaald webhook"}
        </button>
        <button className="button button-dark" type="button" disabled={pending !== null} onClick={() => simulate("failed")}>
          {pending === "failed" ? "…" : "Simuleer mislukt"}
        </button>
        <button className="button button-dark" type="button" disabled={pending !== null} onClick={() => simulate("canceled")}>
          {pending === "canceled" ? "…" : "Simuleer geannuleerd"}
        </button>
      </div>
      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
