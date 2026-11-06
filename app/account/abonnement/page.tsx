import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { CancelSubscriptionButton } from "@/components/billing/checkout-form";
import { readSession } from "@/lib/auth/cookies";
import { BASIS_MONTHLY_LIMIT, PRO_MONTHLY_LIMIT, PRO_PRICE_EUR } from "@/lib/billing/constants";
import { ensureBasisSubscription, getEntitlement } from "@/lib/billing/entitlement";

export const dynamic = "force-dynamic";

export default async function AbonnementPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  ensureBasisSubscription(account.id);
  const entitlement = getEntitlement(account.id);
  const usedPct = Math.min(100, Math.round((entitlement.used / entitlement.limit) * 100));

  return (
    <AccountShell active="abonnement" accountName={account.name} breadcrumb="Mijn WeerSport / Abonnement">
      <p className="eyebrow">Quota &amp; plannen</p>
      <div className="account-heading-row">
        <div>
          <h1>Abonnement &amp; verbruik</h1>
          <p className="account-lead">
            Server-side ledger: Basis {BASIS_MONTHLY_LIMIT} / Pro {PRO_MONTHLY_LIMIT} analyses per kalendermaand.
            Opslaan van plannen blijft 0.
          </p>
        </div>
      </div>

      <section className="account-panel billing-usage">
        <h2>Huidig verbruik · {entitlement.plan === "pro" ? "Pro" : "Basis"}</h2>
        <p className="billing-balance">
          {entitlement.used}
          <span> / {entitlement.limit} analyses</span>
        </p>
        <div className="billing-track" aria-hidden="true">
          <span style={{ width: `${usedPct}%` }} />
        </div>
        <p>Nog {entitlement.remaining} beschikbaar deze periode.</p>
        <p className="account-age">Reset / periode-einde: {formatStamp(entitlement.resetAt)}</p>
        {entitlement.cancelAtPeriodEnd ? (
          <p className="account-disclaimer">Opzegging gepland. Pro blijft actief tot {formatStamp(entitlement.currentPeriodEnd)}.</p>
        ) : null}
      </section>

      <div className="account-summary-grid">
        <article className="account-panel">
          <p className="account-tag">Basis</p>
          <h2>Gratis</h2>
          <p>{BASIS_MONTHLY_LIMIT} nieuwe analyses / maand</p>
          <p>Opgeslagen plannen en filters blijven gratis.</p>
        </article>
        <article className="account-panel">
          <p className="account-tag">Aanbevolen</p>
          <h2>WeerSport Pro</h2>
          <p className="billing-price">€ {PRO_PRICE_EUR}<span> / maand</span></p>
          <p>{PRO_MONTHLY_LIMIT} analyses / maand · advertentievrij</p>
          {entitlement.plan === "pro" ? (
            <CancelSubscriptionButton />
          ) : (
            <Link className="button button-lime" href="/checkout/pro">
              Upgrade naar Pro →
            </Link>
          )}
        </article>
      </div>

      {entitlement.remaining === 0 ? (
        <section className="account-hero-card">
          <p className="account-chip">Limiet bereikt</p>
          <h2>Je maandelijkse analyses zijn op</h2>
          <p>Bekijk opgeslagen momenten of kies Pro. Er is niets extra afgeboekt.</p>
          <div className="account-item-actions">
            <Link className="button button-lime" href="/checkout/pro">
              Upgrade naar Pro · € {PRO_PRICE_EUR}/maand
            </Link>
            <Link className="button button-dark" href="/account/zoekopdrachten">
              Eerdere zoekopdrachten
            </Link>
          </div>
        </section>
      ) : null}
    </AccountShell>
  );
}

function formatStamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}
