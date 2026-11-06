import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { BrandMark } from "@/components/brand-mark";
import { readSession } from "@/lib/auth/cookies";
import { BILLING_DISCLOSURE, PRO_MONTHLY_LIMIT, PRO_PRICE_EUR } from "@/lib/billing/constants";
import { getEntitlement } from "@/lib/billing/entitlement";
import { billingMode, billingModeLabel, checkoutEnabled } from "@/lib/billing/mollie-mode";

export const dynamic = "force-dynamic";

export default async function ProCheckoutPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (!account.verified) redirect("/auth/verifieer");
  const entitlement = getEntitlement(account.id);
  if (entitlement.plan === "pro") redirect("/checkout/succes");
  const mode = billingMode();
  const enabled = checkoutEnabled();

  return (
    <main className="billing-page">
      <header className="billing-nav">
        <Link className="account-brand" href="/">
          <BrandMark size={34} />
          <span>WeerSport.</span>
        </Link>
        <span className="account-badge">Checkout · Pro</span>
      </header>
      <p className="eyebrow">WeerSport Pro</p>
      <h1>Bevestig je Pro-abonnement</h1>
      <p className="account-lead">
        € {PRO_PRICE_EUR}/maand · {PRO_MONTHLY_LIMIT} analyses · opzegbaar per periode · Mollie-modus:{" "}
        {billingModeLabel(mode)}.
      </p>
      {!enabled ? (
        <section className="account-panel" role="status">
          <h2>Checkout tijdelijk uitgeschakeld</h2>
          <p>
            Pro-betalingen staan uit op deze omgeving (geen of ongeldige Mollie-sleutel, of billing
            geforceerd uit). Veiligheid en UV blijven beschikbaar zonder upgrade. Glenn moet merchant
            en sleutels goedkeuren vóór echte betalingen.
          </p>
          <Link href="/account/abonnement">Terug naar abonnement</Link>
        </section>
      ) : (
        <div className="billing-grid">
          <section className="account-panel">
            <p className="account-tag">Abonnement</p>
            <h2>WeerSport Pro</h2>
            <p className="billing-price">
              € {PRO_PRICE_EUR}
              <span> / maand</span>
            </p>
            <dl className="billing-details">
              <div>
                <dt>Quota</dt>
                <dd>{PRO_MONTHLY_LIMIT} analyses / maand</dd>
              </div>
              <div>
                <dt>Betaling</dt>
                <dd>Mollie · doorlopend · € {PRO_PRICE_EUR}</dd>
              </div>
              <div>
                <dt>Vernieuwing</dt>
                <dd>Automatisch per maand tot je opzegt</dd>
              </div>
              <div>
                <dt>Opzeggen</dt>
                <dd>Pro blijft tot einde betaalde periode</dd>
              </div>
              <div>
                <dt>Privacy</dt>
                <dd>Geen ruwe bankgegevens in WeerSport</dd>
              </div>
            </dl>
            <p className="billing-note">{BILLING_DISCLOSURE}</p>
          </section>
          <CheckoutForm email={account.email} />
        </div>
      )}
      <p className="billing-foot">
        <Link href="/account/abonnement">Terug naar abonnement</Link>
        {" · "}
        <Link href="/support/terugbetaling">Terugbetalingsbeleid</Link>
      </p>
    </main>
  );
}
