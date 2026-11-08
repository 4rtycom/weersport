"use client";

export function TestPaymentButton({ token }: { token: string }) {
  async function mark(status: "paid" | "expired" | "canceled", mandate = true) {
    await fetch("/api/sponsoring/test-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, status, mandate }),
    });
    window.location.reload();
  }
  return (
    <div className="account-item-actions">
      <button className="button button-lime" type="button" onClick={() => void mark("paid")}>
        Testadapter: meld betaald
      </button>
      <button className="button button-dark" type="button" onClick={() => void mark("expired")}>
        Testadapter: meld verlopen
      </button>
      <button className="button button-dark" type="button" onClick={() => void mark("canceled")}>
        Testadapter: meld geannuleerd
      </button>
    </div>
  );
}
