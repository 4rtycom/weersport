"use client";

import { useEffect, useState } from "react";
import { INSTALL_DISMISS_MS, installMode, type InstallMode } from "@/lib/pwa/policy";

const DISMISS_KEY = "weersport-pwa-dismiss-until";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function standaloneNow() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

function iosNow() {
  const nav = navigator as Navigator & { platform?: string; maxTouchPoints?: number };
  const ua = nav.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
}

function priorityBlocksBanner() {
  if (document.querySelector(".consent-banner")) return true;
  const blockers = ["#planner", ".safety-note", ".warning-panel"]
    .map((selector) => document.querySelector(selector))
    .filter((element): element is Element => Boolean(element));
  return blockers.some((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  });
}

export function PwaInstall() {
  const [mode, setMode] = useState<InstallMode>("hidden");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Install remains optional when registration fails. */
      });
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const refresh = () => {
      const dismissedUntil = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      setMode(
        installMode({
          standalone: standaloneNow(),
          installed,
          dismissedUntil: Number.isFinite(dismissedUntil) ? dismissedUntil : 0,
          now: Date.now(),
          promptAvailable: Boolean(promptEvent),
          ios: iosNow(),
          blockedByPriority: priorityBlocksBanner(),
        }),
      );
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed, promptEvent]);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + INSTALL_DISMISS_MS));
    setMode("hidden");
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  if (mode === "hidden") return null;

  return (
    <aside className="pwa-banner" aria-label="App installeren" data-dismiss-days="30">
      {mode === "prompt" ? (
        <p>Zet WeerSport op je beginscherm. De browser kan dat nu vragen.</p>
      ) : null}
      {mode === "ios-manual" ? (
        <p>
          Op iPhone of iPad is niet te zien of WeerSport al geïnstalleerd is. Open het deelmenu en kies Zet op
          beginscherm.
        </p>
      ) : null}
      <div className="pwa-banner-actions">
        {mode === "prompt" ? (
          <button className="button button-lime" type="button" onClick={install}>
            Installeer
          </button>
        ) : null}
        <button className="button button-dark" type="button" onClick={dismiss}>
          Niet nu
        </button>
      </div>
    </aside>
  );
}
