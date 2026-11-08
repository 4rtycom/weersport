import Link from "next/link";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { TestPaymentButton } from "@/components/test-payment-button";
import { issueManageToken } from "@/lib/sponsoring/manage";
import { formatEuroCents } from "@/lib/sponsoring/months";
import { paymentStatusView, verifySponsorPayment, checkoutByReturnToken } from "@/lib/sponsoring/checkout";
import styles from "../signup.module.css";

export const dynamic = "force-dynamic";

const COPY: Record<string, string> = {
  open: "Betaling wordt gecontroleerd",
  pending: "Betaling wordt gecontroleerd",
  paid: "Betaling bevestigd",
  expired: "De betaling is verlopen",
  canceled: "De betaling is geannuleerd",
  failed: "De betaling is niet gelukt",
};

export default async function SponsorPaymentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const row = checkoutByReturnToken(token);
  if (row) await verifySponsorPayment({ checkoutId: row.id });
  const view = paymentStatusView(token);
  const manage = view?.status === "paid" ? issueManageToken(view.sponsorId) : null;
  return (
    <>
      <SiteHeaderBar />
      <main id="inhoud" className={styles.main}>
        <p className={styles.kicker}>Betaling</p>
        <h1>{view ? COPY[view.status] ?? "Betaling wordt gecontroleerd" : "Betaling niet gevonden"}</h1>
        {!view ? <p className={styles.lead}>Deze betaalverwijzing is ongeldig.</p> : null}
        {view ? (
          <section className={styles.card}>
            <p>{view.mode === "test" ? "Testadapter. Dit is geen productiebetaling en er is geen incasso gestart." : "Productiebetaling. De status komt van de provider, niet van deze terugkeer."}</p>
            <ul>
              {view.sports.map((sport) => (
                <li key={sport}>{sport}</li>
              ))}
            </ul>
            <p>Bedrag {formatEuroCents(view.grossCents)} inclusief btw.</p>
            {view.billing ? (
              <p>
                Factuuradres: {view.billing.legalName}, {view.billing.street}, {view.billing.postalCode} {view.billing.city}, {view.billing.country}. {view.billing.invoiceEmail}
              </p>
            ) : null}
            {view.status === "paid" ? (
              <p>{view.mandate ? "Machtiging vastgelegd." : "Machtiging ontbreekt. Er volgt geen tweede betaling voor de eerste maand; herstel de machtiging."}</p>
            ) : (
              <p>De betaling is nog niet bevestigd. Terugkeren uit iDEAL activeert het contract niet.</p>
            )}
            <p>Publicatie: {view.moderation === "approved" ? "goedgekeurd" : view.moderation === "rejected" ? `afgekeurd${view.moderationReason ? ` — ${view.moderationReason}` : ""}` : "wacht op controle"}.</p>
            {view.invoice ? <p>Factuurstatus: {view.invoice.status}. Mail: {view.invoice.email_status}. Nummer: {view.invoice.invoice_number ?? "nog niet uitgegeven"}.</p> : <p>Nog geen factuur.</p>}
            {manage ? <p><Link href={`/sponsoring/beheer?token=${manage.token}`}>Beheer je vermelding</Link></p> : null}
            {view.mode === "test" && view.status !== "paid" ? (
              <>
                <p className={styles.help}>De testadapter markeert de providerstatus. Terugkeren uit iDEAL doet dat niet.</p>
                <TestPaymentButton token={token} />
              </>
            ) : null}
          </section>
        ) : null}
      </main>
    </>
  );
}
