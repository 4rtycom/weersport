"use client";

import { useEffect, useRef } from "react";
import styles from "@/components/commercial.module.css";
import type { AffiliateTip as Tip } from "@/lib/affiliate/select";

export function AffiliateTip({ tip, sportId, measure }: { tip: Tip; sportId: string; measure: boolean }) {
  const placement = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  useEffect(() => {
    if (!measure || !placement.current) return;
    const body = JSON.stringify({
      placementId: placement.current,
      kind: "impression",
      offerId: tip.id,
      sportId,
    });
    void fetch("/api/sponsoring/measure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  }, [measure, sportId, tip.id]);

  return (
    <aside className={styles.affiliate} aria-labelledby="affiliate-titel">
      <img src={tip.imageUrl} alt="" width={96} height={96} />
      <div>
        <p className={styles.kicker}>Advertentie · affiliatelink</p>
        <h2 id="affiliate-titel">{tip.name}</h2>
        <p>{tip.explanation}</p>
        {tip.testData ? <p className={styles.test}>Testaanbod. Geen goedgekeurde productfeed.</p> : null}
        <p>
          <a
            href={tip.href}
            rel="sponsored noopener"
            target="_blank"
            onClick={() => {
              if (!measure || !placement.current) return;
              void fetch("/api/sponsoring/measure", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ placementId: placement.current, kind: "click", offerId: tip.id, sportId }),
              });
            }}
          >
            {tip.cta}
          </a>
        </p>
      </div>
    </aside>
  );
}
