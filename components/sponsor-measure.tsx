"use client";

import { useEffect, useRef } from "react";
import { SponsorCard } from "@/components/sponsor-card";

type SponsorCreative = {
  campaignId: string;
  partnerName: string;
  headline: string;
  body: string;
  destinationUrl: string | null;
  placementId: string;
  signature: string;
  sportId: string;
  placeId: string;
};

function sendEvent(creative: SponsorCreative, kind: "eligible" | "impression" | "click") {
  const body = JSON.stringify({
    placementId: creative.placementId,
    signature: creative.signature,
    campaignId: creative.campaignId,
    sportId: creative.sportId,
    placeId: creative.placeId,
    kind,
  });
  if (kind === "click" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon("/api/sponsoring/events", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }
  void fetch("/api/sponsoring/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function SponsorMeasure({
  creative,
  mode,
}: {
  creative: SponsorCreative;
  mode: "show" | "eligible";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const creativeRef = useRef(creative);
  creativeRef.current = creative;

  useEffect(() => {
    const current = creativeRef.current;
    let cancelled = false;
    let timer: number | null = null;
    let intersecting = false;
    let impressionSent = false;
    sendEvent(current, "eligible");
    if (mode !== "show") return undefined;

    const clear = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const arm = () => {
      if (cancelled || impressionSent || timer !== null) return;
      if (!intersecting || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        timer = null;
        if (cancelled || impressionSent) return;
        if (!intersecting || document.visibilityState !== "visible") return;
        impressionSent = true;
        sendEvent(current, "impression");
      }, 1000);
    };
    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
        if (intersecting) arm();
        else clear();
      },
      { threshold: [0, 0.5, 1] },
    );
    if (node) observer.observe(node);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") clear();
      else arm();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clear();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, creative.placementId]);

  if (mode !== "show") {
    return (
      <span
        hidden
        data-sponsor-state="eligible"
        data-sponsor-placement={creative.placementId}
        data-sponsor-signature={creative.signature}
        data-sponsor-campaign={creative.campaignId}
        data-sponsor-sport={creative.sportId}
        data-sponsor-place={creative.placeId}
      />
    );
  }

  return (
    <div
      ref={ref}
      data-sponsor-state="show"
      data-sponsor-placement={creative.placementId}
      data-sponsor-signature={creative.signature}
      data-sponsor-campaign={creative.campaignId}
      data-sponsor-sport={creative.sportId}
      data-sponsor-place={creative.placeId}
    >
      <SponsorCard
        partner={creative.partnerName}
        headline={creative.headline}
        body={creative.body}
        href={creative.destinationUrl}
        onActivate={() => sendEvent(creativeRef.current, "click")}
      />
    </div>
  );
}
