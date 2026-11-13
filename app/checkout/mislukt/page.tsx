import Link from "next/link";
import { PageHero, StatusCard } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";

export default function MisluktPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero eyebrow="Betaling" title="Betaling niet geslaagd" />
        <div className="page-body page-body-narrow">
          <StatusCard
            tone="error"
            title="Je blijft op Basis"
            actions={
              <>
                <Link className="button button-lime" href="/checkout/pro">
                  Opnieuw afrekenen
                </Link>
                <Link className="button button-ghost" href="/account/abonnement">
                  Blijf op Basis
                </Link>
              </>
            }
          >
            <p>Er is geen Pro geactiveerd en er is niets afgeschreven. Probeer het opnieuw of blijf Basis gebruiken.</p>
          </StatusCard>
        </div>
      </main>
    </>
  );
}
