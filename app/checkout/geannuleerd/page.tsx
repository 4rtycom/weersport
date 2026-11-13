import Link from "next/link";
import { PageHero, StatusCard } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";

export default function GeannuleerdPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero eyebrow="Betaling" title="Afrekenen geannuleerd" />
        <div className="page-body page-body-narrow">
          <StatusCard
            tone="neutral"
            title="Er is niets veranderd"
            actions={
              <>
                <Link className="button button-lime" href="/">
                  Verder met Basis
                </Link>
                <Link className="button button-ghost" href="/account/abonnement">
                  Bekijk abonnementen
                </Link>
              </>
            }
          >
            <p>Je hebt niet betaald en je abonnement is niet gewijzigd.</p>
          </StatusCard>
        </div>
      </main>
    </>
  );
}
