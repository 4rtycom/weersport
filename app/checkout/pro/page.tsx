import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { readSession } from "@/lib/auth/cookies";
import { BILLING_DISCLOSURE, PRO_MONTHLY_LIMIT, PRO_PRICE_EUR } from "@/lib/billing/constants";
import { getEntitlement } from "@/lib/billing/entitlement";

export const dynamic = "force-dynamic";

export default async function ProCheckoutPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (!account.verified) redirect("/auth/verifieer");
  const entitlement = getEntitlement(account.id);
  if (entitlement.plan === "pro") redirect("/checkout/succes");

  return (
    <>
      <SiteHeaderBar account />
      <main className="page" id="inhoud">
        <PageHero
          back={{ href: "/account/abonnement", label: "Abonnement" }}
          eyebrow="WeerSport Pro"
          title="Bevestig je Pro-abonnement"
          lead={`€ ${PRO_PRICE_EUR} per maand voor ${PRO_MONTHLY_LIMIT} analyses, zonder advertenties. Opzeggen kan per periode.`}
        />
        <div className="page-body">
        <div className="billing-grid">
          <section className="page-card">
            <h2>WeerSport Pro</h2>
            <p className="billing-price">
              € {PRO_PRICE_EUR}
              <span> / maand</span>
            </p>
            <dl className="billing-details">
              <div>
                <dt>Analyses</dt>
                <dd>{PRO_MONTHLY_LIMIT} analyses / maand</dd>
              </div>
              <div>
                <dt>Betaling</dt>
                <dd>Mollie · doorlopend</dd>
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
        </div>
      </main>
    </>
  );
}
