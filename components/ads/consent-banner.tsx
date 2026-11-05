"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function ConsentBanner({ initialDecided }: { initialDecided: boolean }) {
  const [visible, setVisible] = useState(!initialDecided);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setVisible(!initialDecided);
  }, [initialDecided]);

  async function choose(granted: boolean) {
    setPending(true);
    await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ granted }),
    });
    setPending(false);
    setVisible(false);
    // Reload so server components re-evaluate ad eligibility with the cookie.
    window.location.reload();
  }

  if (!visible) return null;

  return (
    <div className="consent-banner" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-copy">
      <div className="consent-banner-inner">
        <p className="eyebrow">Privacy · EER-consent</p>
        <h2 id="consent-title">Advertenties alleen met jouw toestemming</h2>
        <p id="consent-copy">
          WeerSport toont op Basis maximaal één advertentie ná sportweer en veiligheid. Zonder toestemming laden we
          geen AdSense-verzoek. Pro blijft advertentievrij. Lees ook het{" "}
          <Link href="/privacy">privacybeleid</Link>.
        </p>
        <div className="consent-actions">
          <button className="button button-dark" type="button" disabled={pending} onClick={() => choose(false)}>
            Alleen noodzakelijk
          </button>
          <button className="button button-lime" type="button" disabled={pending} onClick={() => choose(true)}>
            Accepteer advertenties
          </button>
        </div>
      </div>
    </div>
  );
}
