"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAds } from "@/components/ads/ads-provider";
import { AD_SLOT_MIN_HEIGHT_PX } from "@/lib/ads/policy";

type FillState = "loading" | "filled" | "no-fill" | "blocked";

/**
 * One in-content AdSense block. It reserves height while loading (no layout shift), collapses when Google has
 * no ad (no-fill), and renders an invisible marker when ads are not allowed here.
 */
export function AdSlot({ allowed, reason }: { allowed: boolean; reason: string }) {
  const ads = useAds();
  const pathname = usePathname();
  const ref = useRef<HTMLModElement>(null);
  const [state, setState] = useState<FillState>("loading");
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT?.trim();
  const active = allowed && ads.status === "on" && Boolean(slot && ads.client);

  useEffect(() => {
    if (!active) return;
    setState("loading");
    const element = ref.current;
    if (!element) return;
    try {
      const w = window as Window & { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      setState("no-fill");
      return;
    }
    // AdSense sets data-ad-status to "filled" or "unfilled" on the <ins> element.
    const observer = new MutationObserver(() => {
      const status = element.getAttribute("data-ad-status");
      if (status === "filled") setState("filled");
      if (status === "unfilled") setState("no-fill");
    });
    observer.observe(element, { attributes: true, attributeFilter: ["data-ad-status"] });
    const timeout = window.setTimeout(() => {
      if (!element.getAttribute("data-ad-status")) setState("no-fill");
    }, 8000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [active, pathname]);

  if (!allowed || ads.status === "off") {
    return <div hidden data-ad-state="blocked" data-ad-reason={reason} />;
  }
  if (!active || state === "no-fill") {
    return <div hidden className="ad-slot ad-slot-pending" data-ad-state={ads.status === "loading" ? "pending" : "no-fill"} />;
  }

  return (
    <aside
      className={`ad-slot ad-slot-${state}`}
      aria-label="Advertentie"
      data-ad-state={state}
      style={{ minHeight: state === "filled" ? undefined : AD_SLOT_MIN_HEIGHT_PX }}
    >
      <p className="ad-slot-label">Advertentie</p>
      {/* A fresh <ins> per page, so client-side navigation requests a new ad. */}
      <ins
        key={pathname}
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block", minHeight: AD_SLOT_MIN_HEIGHT_PX - 40 }}
        data-ad-client={ads.client ?? undefined}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
