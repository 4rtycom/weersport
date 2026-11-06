import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { isVercelProduction } from "@/lib/auth/release";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "UX-state fixtures",
  robots: { index: false, follow: false },
};

const states = [
  {
    id: "consent",
    title: "Consent",
    detail: "Compacte cookiebanner, accept én weigeren, draft behouden.",
    href: "/?consent=review#planner",
  },
  {
    id: "catalogue",
    title: "Catalogue → planner",
    detail: "Hardlopen preselecteert de planner zonder credits.",
    href: "/?sport=hardlopen#planner",
  },
  {
    id: "auth-resume",
    title: "Account entry",
    detail: "Hervat-copy: zoekopdracht bewaard, analyse nog niet gestart.",
    href: "/auth/hervat",
  },
  {
    id: "quota",
    title: "Quota exhausted",
    detail: "Start-gate toont veiligheid/UV + Pro-pad (live na 5 Basis-analyses).",
    href: "/moment",
  },
  {
    id: "checkout-disabled",
    title: "Checkout disabled",
    detail: "Zichtbare weigering wanneer billingMode=disabled.",
    href: "/checkout/pro",
  },
  {
    id: "checkout-pending",
    title: "Payment pending",
    detail: "Eén volgende actie: wacht op Mollie-verificatie.",
    href: "/checkout/pending",
  },
  {
    id: "checkout-failed",
    title: "Payment failed",
    detail: "Eén volgende actie: opnieuw proberen of support.",
    href: "/checkout/mislukt",
  },
  {
    id: "checkout-cancelled",
    title: "Payment cancelled",
    detail: "Eén volgende actie: terug naar abonnement.",
    href: "/checkout/geannuleerd",
  },
  {
    id: "support",
    title: "Support & refund",
    detail: "Klantroutes zonder staging diagnostics.",
    href: "/support",
  },
  {
    id: "partners",
    title: "Partnership",
    detail: "Samenwerken-bestemming i.p.v. planner-anker.",
    href: "/samenwerken",
  },
  {
    id: "nofill",
    title: "Ads no-fill",
    detail: "Basis SCORED moment met ?ad=nofill layout.",
    href: "/moment?ad=nofill",
  },
] as const;

/** Review-only fixtures index — never indexed; blocked on Vercel production. */
export default function UxStatesPage() {
  if (isVercelProduction()) notFound();

  return (
    <>
      <section className="legal-hero">
        <SiteHeader />
      </section>
      <main className="legal" id="inhoud">
        <p className="eyebrow">Phase 6 · fixtures</p>
        <h1>UX-state referenties</h1>
        <p>
          Visuele en copy-referenties voor consent, planner, quota, checkout en support. Geen live
          Mollie-aankoop. Productie toont 404.
        </p>
        <ul className="support-list">
          {states.map((state) => (
            <li key={state.id}>
              <Link href={state.href}>{state.title}</Link> — {state.detail}
            </li>
          ))}
        </ul>
        <p>
          Score/safety fixtures blijven via Phase 2 env selectors (`WEERSPORT_SOURCE_FIXTURES=1` +
          KNMI/water/ice fixture namen).
        </p>
      </main>
    </>
  );
}
