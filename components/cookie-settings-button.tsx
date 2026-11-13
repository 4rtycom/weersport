"use client";

import { OPEN_CONSENT_EVENT } from "@/components/consent-banner";

export function CookieSettingsButton() {
  return (
    <button type="button" className="footer-button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Cookie-instellingen
    </button>
  );
}
