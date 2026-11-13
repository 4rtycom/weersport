import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";

export const metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero
          title="Support"
          lead="WeerSport geeft sportweer-advies, geen veiligheidsgarantie. Twijfel je over weer, water of ijs? Kijk altijd bij de officiële bronnen: KNMI, Rijkswaterstaat en de lokale zwemwaterstatus."
        />
        <div className="page-body page-body-narrow">
          <ul className="link-cards">
            <li>
              <Link href="/support/terugbetaling">
                <strong>Terugbetalingen en geschillen</strong>
                <span>Pro opzeggen, terugbetalen en wat er met je abonnement gebeurt.</span>
              </Link>
            </li>
            <li>
              <Link href="/privacy">
                <strong>Privacy</strong>
                <span>Cookies, advertenties en je rechten als accounthouder.</span>
              </Link>
            </li>
            <li>
              <Link href="/account/privacy">
                <strong>Je gegevens exporteren of verwijderen</strong>
                <span>Na inloggen, onder Privacy in je account.</span>
              </Link>
            </li>
          </ul>
          <section className="page-card page-card-muted">
            <h2>Voor beheerders</h2>
            <p>
              Databasestatus en responstijd: <code>/api/health</code>. Testmatrix en akkoord voor livegang:{" "}
              <Link href="/release-gate">release-gate</Link>.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
