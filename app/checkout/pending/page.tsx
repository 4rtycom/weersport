import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { readSession } from "@/lib/auth/cookies";
import { BILLING_DISCLOSURE } from "@/lib/billing/constants";
import { getCheckoutPublic, mollieMode, verifyAndApplyPayment } from "@/lib/billing/mollie";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const params = await searchParams;
  if (params.checkout) {
    const checkout = getCheckoutPublic(params.checkout, account.id);
    if (checkout && mollieMode() === "live-api") {
      const verified = await verifyAndApplyPayment({ checkoutId: checkout.id, expectedUserId: account.id });
      if (verified.ok && verified.state === "payment_paid") redirect("/checkout/succes");
      if (verified.ok && verified.state === "payment_failed") redirect("/checkout/mislukt");
      if (verified.ok && verified.state === "cancelled") redirect("/checkout/geannuleerd");
    }
  }

  return (
    <>
      <SiteHeaderBar account />
      <main className="billing-page" id="inhoud">
        <p className="account-tag">Betaling pending</p>
        <p className="eyebrow">Mollie</p>
        <h1>Betaling wordt gecontroleerd</h1>
        <p className="account-lead">{BILLING_DISCLOSURE}</p>
        <section className="account-panel">
          <p className="account-tag">Pending</p>
          <h2>Nog geen Pro-activatie</h2>
          <p>We wachten op de geverifieerde Mollie-status. Je Basis-account blijft actief.</p>
        </section>
        <div className="account-item-actions">
          <Link className="button button-dark" href="/account/facturering">
            Naar facturering
          </Link>
          <Link className="button button-lime" href="/">
            Terug naar home
          </Link>
        </div>
      </main>
    </>
  );
}
