"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefundButton({ invoiceId }: { invoiceId?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onRefund() {
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/billing/refund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Terugbetaling mislukt.");
      return;
    }
    setMessage(typeof data.message === "string" ? data.message : "Terugbetaling verwerkt.");
    router.refresh();
  }

  return (
    <div className="refund-actions">
      <button className="button button-dark" type="button" disabled={pending} onClick={onRefund}>
        {pending ? "Bezig…" : "Simuleer terugbetaling"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
