import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { robotsDirective, supportEmail, supportMailto } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support",
  description: "Hulp bij WeerSport: account, privacy, terugbetalingen en partnerschap.",
  robots: robotsDirective(),
};

export default function SupportPage() {
  return (
    <>
      <section className="legal-hero">
        <SiteHeader />
      </section>
      <main className="legal" id="inhoud">
        <p className="eyebrow">Hulp</p>
        <h1>Support</h1>
        <p>
          WeerSport is een sportweer-advies, geen veiligheidsgarantie. Bij twijfel over weer, water of ijs raadpleeg
          altijd de officiële bronnen (KNMI, RWS, lokale zwemwaterstatus).
        </p>
        <ul className="support-list">
          <li>
            <a href={supportMailto("WeerSport support")}>Mail support</a> — {supportEmail()}
          </li>
          <li>
            <Link href="/support/terugbetaling">Terugbetalingen &amp; geschillen</Link> — Pro via Mollie, refundpad en
            contactroute.
          </li>
          <li>
            <Link href="/privacy">Privacy</Link> — cookies, AdSense en accountrechten.
          </li>
          <li>
            <Link href="/account/privacy">Export &amp; verwijdering</Link> — na inloggen, inclusief cookiekeuze
            intrekken.
          </li>
          <li>
            <Link href="/samenwerken">Samenwerken</Link> — sportpartnerschap zonder invloed op scores.
          </li>
          <li>
            <Link href="/voorwaarden">Voorwaarden</Link> — abonnement, opzeggen en aansprakelijkheid.
          </li>
        </ul>
        <Link href="/">Terug naar homepage</Link>
      </main>
    </>
  );
}
