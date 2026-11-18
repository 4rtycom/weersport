"use client";

import { useAds } from "@/components/ads/ads-provider";
import { openCookieSettings } from "@/lib/ads/cmp";

/** Reopens Google's consent message. Only shown where that message is on the page (visitors who get ads). */
export function CookieSettingsButton() {
  const ads = useAds();
  if (ads.status !== "on") return null;
  return (
    <button type="button" className="footer-button" onClick={openCookieSettings}>
      Cookie-instellingen
    </button>
  );
}
