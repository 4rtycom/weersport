import Link from "next/link";
import { redirect } from "next/navigation";
import { SimulatePaymentButtons } from "@/components/billing/checkout-form";
import { BrandMark } from "@/components/brand-mark";
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
    <main className="billing-page">
      <header className="billing-nav">
        <Link className="account-brand" href="/">
          <BrandMark size={34} />
          <span>WeerSport.</span>
        </Link>
        <span className="account-badge">Mollie sandbox</span>
      </header>
      <p className="eyebrow">Providerautorisatie</p>
      <h1>Bevestig betaling bij Mollie (lokaal)</h1>
      <p className="account-lead">
        Dit scherm vervangt Mollie Checkout zonder API-key. WeerSport activeert Pro pas na server-side statuscheck.
      </p>
      <section className="account-panel">
        <p className="account-tag">Eerste betaling</p>
        <h2>WeerSport Pro</h2>
        <p className="billing-price">€ {PRO_PRICE_EUR}</p>
        <p>Checkout {checkout.id.slice(0, 8)} · status {checkout.state}</p>
        <SimulatePaymentButtons checkoutId={checkout.id} />
      </section>
      <p className="billing-foot">
        <Link href={`/checkout/pending?checkout=${checkout.id}`}>Naar pending-scherm zonder bevestiging</Link>
      </p>
    </main>
  );
}
