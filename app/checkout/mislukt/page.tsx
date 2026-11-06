import Link from "next/link";
import { SiteHeaderBar } from "@/components/site-header-bar";

export default function MisluktPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="billing-page" id="inhoud">
        <p className="account-tag">Betaling mislukt</p>
        <p className="eyebrow">Mollie</p>
        <h1>Betaling niet geslaagd</h1>
        <p className="account-lead">Er is geen Pro geactiveerd en er is geen extra incasso gestart.</p>
        <section className="account-panel">
          <p className="account-tag">Failed</p>
          <h2>Basis blijft actief</h2>
          <p>Je kunt het opnieuw proberen of gewoon Basis blijven gebruiken.</p>
        </section>
        <div className="account-item-actions">
          <Link className="button button-lime" href="/checkout/pro">
            Opnieuw afrekenen
          </Link>
          <Link className="button button-dark" href="/account/abonnement">
            Blijf op Basis
          </Link>
        </div>
      </main>
    </>
  );
}
