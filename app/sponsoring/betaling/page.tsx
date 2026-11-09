import Link from "next/link";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { TestPaymentButton } from "@/components/test-payment-button";
import { issueManageToken } from "@/lib/sponsoring/manage";
import { formatEuroCents } from "@/lib/sponsoring/months";
import { paymentStatusView, verifySponsorPayment, checkoutByReturnToken, invoiceDeliverySentence } from "@/lib/sponsoring/checkout";
import styles from "../signup.module.css";

export const dynamic = "force-dynamic";

const TITLE: Record<string, string> = {
  open: "Betaling wordt gecontroleerd",
  pending: "Betaling wordt gecontroleerd",
  paid: "Betaling bevestigd",
  expired: "De betaling is verlopen",
  canceled: "De betaling is geannuleerd",
  failed: "De betaling is niet gelukt",
};

const STATUS: Record<string, string> = {
  open: "Betaling wordt gecontroleerd",
  pending: "Betaling wordt gecontroleerd",
  paid: "Eerste maand betaald met iDEAL",
  expired: "De iDEAL-betaling is verlopen",
  canceled: "De iDEAL-betaling is geannuleerd",
  failed: "De iDEAL-betaling is niet gelukt",
};

function countryName(code: string) {
  return code === "NL" ? "Nederland" : code;
}

export default async function SponsorPaymentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const row = checkoutByReturnToken(token);
  if (row) await verifySponsorPayment({ checkoutId: row.id });
  const view = paymentStatusView(token);
  const manage = view?.status === "paid" ? issueManageToken(view.sponsorId) : null;
  const paid = view?.status === "paid";
  const test = view?.mode === "test";

  return (
    <>
      <SiteHeaderBar />
      <main id="inhoud" className={styles.receipt}>
        {!view ? (
          <>
            <h1>Betaling niet gevonden</h1>
            <p className={styles.lead}>Deze betaalverwijzing is ongeldig.</p>
          </>
        ) : (
          <>
            {test ? (
              <p className={styles.testBanner} role="status">
                Testadapter. Dit is geen productiebetaling en er is geen incasso gestart.
              </p>
            ) : null}
            <h1>{TITLE[view.status] ?? "Betaling wordt gecontroleerd"}</h1>
            <section className={styles.payCard} aria-labelledby="betaling-sponsor">
              <h2 id="betaling-sponsor">{view.publicName}</h2>
              <p className={styles.payCount}>{view.sports.length} van 24 geselecteerd</p>
              <p className={styles.paySports}>{view.sports.join(", ")}</p>
              <p className={styles.payStatus}>{STATUS[view.status] ?? "Betaling wordt gecontroleerd"}</p>
              <p className={styles.payAmount}>{formatEuroCents(view.grossCents)}</p>
              <p className={styles.payNote}>
                {paid && view.mandate && !test
                  ? "Daarna schrijft Mollie hetzelfde bedrag maandelijks via SEPA af. Je vermelding wordt na controle zichtbaar bij de gekozen sporten."
                  : paid && view.mandate
                    ? "In de testadapter wordt dit bedrag niet maandelijks afgeschreven. Je vermelding wordt na controle zichtbaar bij de gekozen sporten."
                    : paid
                      ? "Machtiging ontbreekt. Er volgt geen tweede betaling voor de eerste maand; herstel de machtiging."
                      : "Terugkeren uit iDEAL activeert het contract niet. Er is nog geen incasso gestart."}
              </p>
            </section>
            {view.billing ? (
              <section className={styles.payCard} aria-labelledby="factuur-mail">
                <h2 id="factuur-mail">Je factuur per e-mail</h2>
                <p className={styles.payMail}>
                  {invoiceDeliverySentence({
                    mode: view.mode,
                    emailStatus: view.invoice?.email_status,
                    invoiceEmail: view.billing.invoiceEmail,
                  })}
                </p>
                <address className={styles.payAddress}>
                  {view.billing.legalName}
                  <br />
                  {view.billing.street}
                  <br />
                  {view.billing.postalCode} {view.billing.city}
                  <br />
                  {countryName(view.billing.country)}
                </address>
              </section>
            ) : null}
            {manage ? (
              <p className={styles.manageLink}>
                <Link href={`/sponsoring/beheer?token=${manage.token}`}>Beheer je vermelding</Link>
              </p>
            ) : null}
            {test && !paid ? (
              <div className={styles.testBox}>
                <p className={styles.payMail}>De testadapter zet de providerstatus. Deze knoppen starten geen echte incasso.</p>
                <TestPaymentButton token={token} />
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
