"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function ConsentBanner({ initialDecided }: { initialDecided: boolean }) {
  const [visible, setVisible] = useState(!initialDecided);
  const [pending, setPending] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setVisible(!initialDecided);
  }, [initialDecided]);

  useEffect(() => {
    if (!visible) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [visible]);

  async function choose(granted: boolean) {
    setPending(true);
    // Persist draft fields via cookies already; avoid wiping client planner state by soft-hide then soft reload of consent-dependent islands.
    await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ granted }),
    });
    setPending(false);
    setVisible(false);
    // Server components (ads) need the new cookie; draft lives in cookies/account so planner selections survive.
    window.location.reload();
  }

  if (!visible) return null;

  return (
    <>
      <div className="consent-reserve" aria-hidden="true" />
      <div className="consent-banner" role="dialog" aria-modal="false" aria-labelledby="consent-title" aria-describedby="consent-copy">
        <div className="consent-banner-inner">
          <p className="eyebrow">Privacy · cookies</p>
          <h2 id="consent-title" tabIndex={-1} ref={titleRef}>
            Cookies alleen met jouw toestemming
          </h2>
          <p id="consent-copy">
            We gebruiken noodzakelijke cookies voor account en sessie. Optionele cookies (zoals voor AdSense op Basis)
            zetten we pas na jouw keuze. Pro blijft advertentievrij. Meer in het{" "}
            <Link href="/privacy">privacybeleid</Link>.
          </p>
          <div className="consent-actions">
            <button className="button button-dark" type="button" disabled={pending} onClick={() => choose(false)}>
              Alleen noodzakelijk
            </button>
            <button className="button button-lime" type="button" disabled={pending} onClick={() => choose(true)}>
              Accepteer cookies
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
