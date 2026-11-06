import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { RefundButton } from "@/components/billing/refund-button";
import { readSession } from "@/lib/auth/cookies";
import { getEntitlement } from "@/lib/billing/entitlement";
import { listInvoices, mollieMode } from "@/lib/billing/mollie";

export const dynamic = "force-dynamic";

export default async function FactureringPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const entitlement = getEntitlement(account.id);
  const invoices = listInvoices(account.id);

  return (
    <AccountShell active="facturering" accountName={account.name} breadcrumb="Mijn WeerSport / Facturering">
      <p className="eyebrow">Betalingen</p>
      <div className="account-heading-row">
        <div>
          <h1>Facturering</h1>
          <p className="account-lead">
            Mollie-modus: {mollieMode()}. Facturen verschijnen na geverifieerde betaling. Geen ruwe betaalgegevens in
            WeerSport.
          </p>
        </div>
        {entitlement.plan !== "pro" ? (
          <Link className="button button-lime" href="/checkout/pro">
            Naar Pro-checkout
          </Link>
        ) : null}
      </div>

      <section className="account-panel">
        <h2>Huidig plan</h2>
        <p>
          {entitlement.plan === "pro" ? "WeerSport Pro" : "Basis"} · status {entitlement.state}
        </p>
        {entitlement.currentPeriodEnd ? <p>Periode tot {formatStamp(entitlement.currentPeriodEnd)}</p> : null}
      </section>

      <section>
        <h2 className="account-section-title">Facturen</h2>
        {invoices.length === 0 ? (
          <div className="account-panel">
            <p>Nog geen facturen. Pro-betalingen verschijnen hier na Mollie-bevestiging.</p>
          </div>
        ) : (
          <ul className="account-card-grid">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="account-item-card">
                <h3>{invoice.description}</h3>
                <p>
                  € {(invoice.amount_cents / 100).toFixed(2)} · {invoice.status}
                </p>
                <p className="account-age">{formatStamp(invoice.issued_at)}</p>
                {invoice.status === "paid" && mollieMode() === "sandbox-local" ? (
                  <RefundButton invoiceId={invoice.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="account-panel">
        <h2>Support & terugbetalingen</h2>
        <p>Beleid en contactroutes voor refunds en geschillen staan op de supportpagina.</p>
        <Link href="/support/terugbetaling">Bekijk terugbetalingsbeleid →</Link>
      </section>
    </AccountShell>
  );
}

function formatStamp(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}
