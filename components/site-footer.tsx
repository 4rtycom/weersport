import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { footerNav } from "@/lib/site";

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
      <nav className="footer-columns" aria-label="Sitemap">
        {footerNav.map((column) => (
          <div key={column.title}>
            <h2>{column.title}</h2>
            <ul>
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <p className="footer-disclaimer">
        WeerSport-moment is een advies, geen veiligheidsgarantie. Weerdata: Open-Meteo (CC BY 4.0). Alleen voor
        locaties in Nederland.
      </p>
    </footer>
  );
}
