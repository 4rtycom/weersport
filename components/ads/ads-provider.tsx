"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { fullScreenAllowed } from "@/lib/ads/policy";

type AdsState = { status: "loading" | "on" | "off"; client: string | null };

const AdsContext = createContext<AdsState>({ status: "loading", client: null });

export function useAds() {
  return useContext(AdsContext);
}

/** Marks links so Google's full-screen vignettes never start on, or lead into, excluded pages. */
function guardLinks(pathname: string) {
  const here = fullScreenAllowed(pathname);
  for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    let allowed = here;
    if (allowed) {
      try {
        const url = new URL(anchor.href, window.location.href);
        allowed = url.origin === window.location.origin && fullScreenAllowed(url.pathname);
      } catch {
        allowed = false;
      }
    }
    if (allowed) anchor.removeAttribute("data-google-vignette");
    else anchor.setAttribute("data-google-vignette", "false");
  }
}

/**
 * Loads AdSense once, and only for visitors who get ads: AdSense set up, not Pro, and optional cookies accepted in
 * our own banner (the banner reloads the page after a choice, so this re-checks). Without consent nothing loads.
 */
export function AdsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdsState>({ status: "loading", client: null });
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ads/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ ads?: boolean; client?: string | null }>)
      .then((body) => {
        if (cancelled) return;
        setState(body.ads && body.client ? { status: "on", client: body.client } : { status: "off", client: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "off", client: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "on" || !state.client) return;
    if (!document.querySelector("script[data-ws-adsense]")) {
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${state.client}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.wsAdsense = "true";
      document.head.appendChild(script);
    }
  }, [state]);

  useEffect(() => {
    if (state.status !== "on") return;
    guardLinks(pathname);
    const observer = new MutationObserver(() => guardLinks(pathname));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [state.status, pathname]);

  return <AdsContext.Provider value={state}>{children}</AdsContext.Provider>;
}
