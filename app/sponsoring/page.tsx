import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SponsoringForm } from "@/components/sponsoring-form";
import { businessInbox } from "@/lib/sponsoring/store";

export const metadata: Metadata = {
  title: "Sponsoring",
  description: "Word sportpartner van WeerSport. Sponsoring is herkenbaar en beïnvloedt nooit de weerscore.",
};

export default function SponsoringPage() {
  const inbox = businessInbox();
  return (
    <>
      <section className="legal-hero">
        <SiteHeader />
      </section>
      <main className="legal" id="inhoud">
        <p className="eyebrow">Partnerschap</p>
        <h1>Sponsoring</h1>
        <p>
          Sponsoring op WeerSport is duidelijk herkenbaar en staat los van het sportadvies. Een partner vermeldt nooit
          de score, de UV-index of een veiligheidswaarschuwing. Homepage, checkout en schermen zonder score blijven
          vrij van sponsoring.
        </p>
        <p>
          {inbox
            ? `Aanvragen worden bewaard voor de zakelijke inbox ${inbox}. Deze pagina verstuurt zelf geen e-mail.`
            : "Aanvragen worden duurzaam opgeslagen. Er is nog geen zakelijke inbox geconfigureerd, en deze pagina verstuurt geen e-mail."}
        </p>
        <SponsoringForm />
        <nav className="footer-links" aria-label="Vervolg">
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/">Homepage</Link>
        </nav>
      </main>
    </>
  );
}
