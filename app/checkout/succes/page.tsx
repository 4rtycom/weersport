import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { readSession } from "@/lib/auth/cookies";
import { PRO_MONTHLY_LIMIT } from "@/lib/billing/constants";
import { getEntitlement } from "@/lib/billing/entitlement";

export const dynamic = "force-dynamic";

export default async function SuccesPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const entitlement = getEntitlement(account.id);
  if (entitlement.plan !== "pro") redirect("/checkout/pending");

  return (
    <main className="billing-page">
      <header className="billing-nav">
        <Link className="account-brand" href="/">
          <BrandMark size={34} />
          <span>WeerSport.</span>
        </Link>
        <span className="account-badge">Pro actief</span>
      </header>
      <p className="eyebrow">Gelukt</p>
      <h1>WeerSport Pro is geactiveerd</h1>
      <p className="account-lead">Geverifieerde Mollie-status ontvangen. Limiet: {PRO_MONTHLY_LIMIT} analyses / maand.</p>
      <section className="account-hero-card">
        <p className="account-chip">Pro</p>
        <h2>Welkom bij Pro</h2>
        <p>
          Verbruik {entitlement.used}/{entitlement.limit}. Periode tot{" "}
          {entitlement.currentPeriodEnd
            ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeZone: "Europe/Amsterdam" }).format(
                new Date(entitlement.currentPeriodEnd),
              )
            : "—"}
          .
        </p>
      </section>
      <div className="account-item-actions">
        <Link className="button button-lime" href={account.draft ? "/moment" : "/#planner"}>
          Verder met je zoekopdracht →
        </Link>
        <Link className="button button-dark" href="/account/facturering">
          Bekijk facturering
        </Link>
      </div>
    </main>
  );
}
