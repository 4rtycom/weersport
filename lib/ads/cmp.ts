/**
 * Google's certified consent message (Funding Choices, a TCF-certified CMP). Client-side helpers only.
 * Google shows the message to visitors who need it, stores their choice, and limits ads when they decline.
 */

type GoogleFc = {
  callbackQueue?: Array<Record<string, () => void>>;
  showRevocationMessage?: () => void;
};

type TcfData = { purpose?: { consents?: Record<string, boolean> } };
type TcfApi = (
  command: "addEventListener",
  version: 2,
  callback: (data: TcfData & { eventStatus?: string }, success: boolean) => void,
) => void;

type CmpWindow = Window & { googlefc?: GoogleFc; __tcfapi?: TcfApi };

export const CMP_SCRIPT_ATTRIBUTE = "data-ws-cmp";

/** Loads the consent message once. Google needs the `googlefcPresent` iframe as proof that the CMP is on the page. */
export function loadConsentMessage(client: string) {
  if (document.querySelector(`script[${CMP_SCRIPT_ATTRIBUTE}]`)) return;
  const publisher = client.replace(/^ca-/, "");
  const script = document.createElement("script");
  script.src = `https://fundingchoicesmessages.google.com/i/${publisher}?ers=1`;
  script.async = true;
  script.setAttribute(CMP_SCRIPT_ATTRIBUTE, "true");
  document.head.appendChild(script);

  if (!document.querySelector('iframe[name="googlefcPresent"]')) {
    const frame = document.createElement("iframe");
    frame.name = "googlefcPresent";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "display:none;width:0;height:0;border:none;position:absolute;left:-1000px;top:-1000px";
    document.body.appendChild(frame);
  }
}

/** Opens Google's privacy choices again, so people can change or withdraw their consent. */
export function openCookieSettings() {
  const w = window as CmpWindow;
  w.googlefc = w.googlefc ?? {};
  w.googlefc.callbackQueue = w.googlefc.callbackQueue ?? [];
  w.googlefc.callbackQueue.push({ CONSENT_API_READY: () => w.googlefc?.showRevocationMessage?.() });
}

/**
 * Mirrors the visitor's choice in Google's message into our own cookie, which the sponsor measurement reads.
 * Counts as consent only when the visitor allowed storing and reading information on their device (TCF purpose 1).
 * Where the message never appears (no tcfapi), nothing is written and measurement stays off.
 */
export function mirrorConsent(onChange: (granted: boolean) => void) {
  let tries = 0;
  const timer = window.setInterval(() => {
    const api = (window as CmpWindow).__tcfapi;
    tries += 1;
    if (!api) {
      if (tries > 40) window.clearInterval(timer);
      return;
    }
    window.clearInterval(timer);
    api("addEventListener", 2, (data, success) => {
      if (!success) return;
      if (data.eventStatus !== "tcloaded" && data.eventStatus !== "useractioncomplete") return;
      onChange(data.purpose?.consents?.["1"] === true);
    });
  }, 500);
  return () => window.clearInterval(timer);
}
