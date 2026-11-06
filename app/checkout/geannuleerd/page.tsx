import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function GeannuleerdPage() {
  return (
    <main className="billing-page">
      <header className="billing-nav">
        <Link className="account-brand" href="/">
          <BrandMark size={34} />
          <span>WeerSport.</span>
        </Link>
        <span className="account-badge">Checkout geannuleerd</span>
      </header>
      <p className="eyebrow">Mollie</p>
      <h1>Checkout geannuleerd</h1>
      <p className="account-lead">Geen betaling, geen Pro-wijziging.</p>
      <div className="account-item-actions">
        <Link className="button button-dark" href="/account/abonnement">
          Terug naar plannen
        </Link>
        <Link className="button button-lime" href="/">
          Verder met Basis
        </Link>
      </div>
    </main>
  );
}
