import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHero, StatusCard } from "@/components/page-hero";
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
      <main className="page" id="inhoud">
        <PageHero eyebrow="Betaling" title="We controleren je betaling" />
        <div className="page-body page-body-narrow">
          <StatusCard
            tone="pending"
            title="Pro is nog niet actief"
            actions={
              <>
                <Link className="button button-dark" href="/account/facturering">
                  Naar facturering
                </Link>
                <Link className="button button-ghost" href="/">
                  Terug naar home
                </Link>
              </>
            }
          >
            <p>We wachten op de bevestiging van Mollie. Je Basis-account blijft gewoon werken.</p>
            <p className="status-note">{BILLING_DISCLOSURE}</p>
          </StatusCard>
        </div>
      </main>
    </>
  );
}
