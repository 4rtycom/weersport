import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHero, StatusCard } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
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
    <>
      <SiteHeaderBar account />
      <main className="page" id="inhoud">
        <PageHero eyebrow="Betaling geslaagd" title="WeerSport Pro is geactiveerd" />
        <div className="page-body page-body-narrow">
          <StatusCard
            tone="success"
            title="Welkom bij Pro"
            actions={
              <>
                <Link className="button button-lime" href={account.draft ? "/moment" : "/#planner"}>
                  Verder met je zoekopdracht →
                </Link>
                <Link className="button button-ghost" href="/account/facturering">
                  Bekijk facturering
                </Link>
              </>
            }
          >
            <p>
              Mollie heeft je betaling bevestigd. Je hebt nu {PRO_MONTHLY_LIMIT} analyses per maand; {entitlement.used}{" "}
              daarvan gebruikt. Pro loopt tot{" "}
              {entitlement.currentPeriodEnd
                ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "long", timeZone: "Europe/Amsterdam" }).format(
                    new Date(entitlement.currentPeriodEnd),
                  )
                : "het einde van de periode"}
              .
            </p>
          </StatusCard>
        </div>
      </main>
    </>
  );
}
