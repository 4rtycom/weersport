import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function MisluktPage() {
  return (
    <main className="billing-page">
      <header className="billing-nav">
        <Link className="account-brand" href="/">
          <BrandMark size={34} />
          <span>WeerSport.</span>
        </Link>
        <span className="account-badge">Betaling mislukt</span>
      </header>
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
  );
}
