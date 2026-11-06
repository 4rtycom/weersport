import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BrandMark } from "@/components/brand-mark";
import { partnershipEmail, partnershipMailto, robotsDirective, SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  title: "Samenwerken",
  description: "Word sportpartner van WeerSport. Sponsoring is herkenbaar en beïnvloedt nooit de weerscore.",
  robots: robotsDirective(),
};

export default function SamenwerkenPage() {
  return (
    <>
      <section className="legal-hero">
        <SiteHeader />
      </section>
      <main className="legal" id="inhoud">
        <p className="eyebrow">Partnerschap</p>
        <h1>Samenwerken met WeerSport</h1>
        <p>
          Sponsoring op WeerSport is duidelijk herkenbaar en beïnvloedt nooit sportscores, UV of
          veiligheid. We plaatsen geen advertenties op de homepage, checkout of kritieke NO_SCORE-
          schermen.
        </p>
        <p>
          Interesse? Mail naar{" "}
          <a href={partnershipMailto()}>{partnershipEmail()}</a> met je merk, sportcategorie en
          gewenste zichtbaarheid.
        </p>
        <p className="legal-meta">
          Contactadres is configureerbaar via omgeving (Glenn). Tot goedkeuring van een publiek
          domein blijft deze pagina noindex.
        </p>
        <nav className="footer-links" aria-label="Vervolg">
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/">Homepage</Link>
        </nav>
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          <BrandMark size={42} />
          <p>WeerSport.</p>
        </div>
        <p className="footer-tagline">{SITE_DESCRIPTION}</p>
      </footer>
    </>
  );
}
