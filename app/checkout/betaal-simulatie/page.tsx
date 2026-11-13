import Link from "next/link";
import { redirect } from "next/navigation";
import { SimulatePaymentButtons } from "@/components/billing/checkout-form";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { readSession } from "@/lib/auth/cookies";
import { PRO_PRICE_EUR } from "@/lib/billing/constants";
import { getCheckoutPublic, mollieMode } from "@/lib/billing/mollie";

export const dynamic = "force-dynamic";

export default async function BetaalSimulatiePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (mollieMode() !== "sandbox-local") redirect("/checkout/pending");
  const params = await searchParams;
  if (!params.checkout) redirect("/checkout/pro");
  const checkout = getCheckoutPublic(params.checkout, account.id);
  if (!checkout) redirect("/checkout/pro");

  return (
    <>
      <SiteHeaderBar account />
      <main className="page" id="inhoud">
        <PageHero
          eyebrow="Mollie-sandbox"
          title="Bevestig de testbetaling"
          lead="Dit scherm vervangt Mollie Checkout zolang er geen API-sleutel is. Pro wordt pas actief na een controle op de server."
        />
        <div className="page-body page-body-narrow">
          <section className="page-card">
            <h2>WeerSport Pro</h2>
            <p className="billing-price">€ {PRO_PRICE_EUR}</p>
            <p className="billing-note">
              Checkout {checkout.id.slice(0, 8)}, status {checkout.state}
            </p>
            <SimulatePaymentButtons checkoutId={checkout.id} />
          </section>
          <p className="billing-foot">
            <Link href={`/checkout/pending?checkout=${checkout.id}`}>Naar het wachtscherm zonder bevestiging</Link>
          </p>
        </div>
      </main>
    </>
  );
}
