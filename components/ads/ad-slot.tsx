"use client";

import { useEffect, useRef, useState } from "react";
import { AD_SLOT_MIN_HEIGHT_PX, adsenseConfigured } from "@/lib/ads/policy";

type FillState = "idle" | "loading" | "filled" | "no-fill" | "blocked";

export function AdSlot({
  allowed,
  reason,
  label = "Advertentie",
}: {
  allowed: boolean;
  reason: string;
  label?: string;
}) {
  const [state, setState] = useState<FillState>(allowed ? "loading" : "blocked");
  const ref = useRef<HTMLModElement>(null);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
  const configured = Boolean(client && slot);

  useEffect(() => {
    if (!allowed) {
      setState("blocked");
      return;
    }
    setState("loading");

    if (!configured) {
      // Sandbox: demonstrate fill/no-fill without loading third-party scripts.
      const timer = window.setTimeout(() => {
        const forceNoFill = window.location.search.includes("ad=nofill");
        setState(forceNoFill ? "no-fill" : "filled");
      }, 450);
      return () => window.clearTimeout(timer);
    }

    const w = window as Window & { adsbygoogle?: unknown[] };
    w.adsbygoogle = w.adsbygoogle || [];
    try {
      w.adsbygoogle.push({});
      const timer = window.setTimeout(() => {
        const ins = ref.current;
        const status = ins?.getAttribute("data-ad-status");
        // Reserved min-height survives an AdSense height:0 collapse, so only extra height counts.
        const reservedHeight = AD_SLOT_MIN_HEIGHT_PX - 36;
        const filled =
          status === "filled" ||
          (status !== "unfilled" && (ins?.clientHeight ?? 0) > reservedHeight);
        setState(filled ? "filled" : "no-fill");
      }, 1800);
      return () => window.clearTimeout(timer);
    } catch {
      setState("no-fill");
    }
  }, [allowed, configured]);

  if (!allowed) {
    return (
      <aside className="ad-slot ad-slot-blocked" aria-label="Advertentie uitgesloten" data-ad-state="blocked">
        <p className="ad-slot-label">Geen advertentie</p>
        <p>{reason}</p>
      </aside>
    );
  }

  return (
    <aside
      className={`ad-slot ad-slot-${state}`}
      aria-label={label}
      data-ad-state={state}
      style={{ minHeight: AD_SLOT_MIN_HEIGHT_PX }}
    >
      <p className="ad-slot-label">
        {state === "loading" && "Advertentie laden…"}
        {state === "filled" && "Advertentie"}
        {state === "no-fill" && "Geen advertentie beschikbaar (no-fill)"}
        {state === "idle" && "Advertentie"}
      </p>
      {configured ? (
        <ins
          ref={ref}
          className="adsbygoogle"
          style={{ display: "block", minHeight: AD_SLOT_MIN_HEIGHT_PX - 36 }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="ad-slot-sandbox" aria-hidden={state !== "filled"}>
          {state === "filled" ? (
            <p>Sandbox-advertentie · één handmatig Basis-slot · vaste hoogte tegen CLS</p>
          ) : state === "no-fill" ? (
            <p>No-fill: ruimte blijft gereserveerd, layout schuift niet.</p>
          ) : (
            <p>Bezig met laden…</p>
          )}
        </div>
      )}
      <p className="ad-slot-note">{reason} AdSense is geen sport+radius-targetingengine.</p>
    </aside>
  );
}

export function AdSenseScript({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !adsenseConfigured()) return;
    if (document.querySelector("script[data-ws-adsense]")) return;
    const script = document.createElement("script");
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.wsAdsense = "true";
    document.head.appendChild(script);
  }, [enabled]);
  return null;
}
