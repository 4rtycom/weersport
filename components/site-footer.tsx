import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

/** The one site footer. Pages should not render another. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandMark size={42} />
        <div>
          <p>WeerSport.</p>
          <p className="footer-tagline">Wat is jouw beste sportmoment?</p>
        </div>
      </div>
      <nav className="footer-links" aria-label="Juridisch en support">
        <Link href="/privacy">Privacy</Link>
        <Link href="/voorwaarden">Voorwaarden</Link>
        <Link href="/support">Support</Link>
        <Link href="/sponsoring">Samenwerken</Link>
      </nav>
      <p className="footer-disclaimer">WeerSport-moment is een advies, geen veiligheidsgarantie.</p>
    </footer>
  );
}
