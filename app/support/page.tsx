import Link from "next/link";
import { SiteHeaderBar } from "@/components/site-header-bar";

export const metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <>
      <SiteHeaderBar />
      <main className="legal" id="inhoud">
        <p className="eyebrow">Hulp & monitoring</p>
        <h1>Support</h1>
        <p>
          WeerSport is een sportweer-advies, geen veiligheidsgarantie. Bij twijfel over weer, water of ijs raadpleeg
          altijd de officiële bronnen (KNMI, RWS, lokale zwemwaterstatus).
        </p>
        <ul className="support-list">
          <li>
            <Link href="/support/terugbetaling">Terugbetalingen & geschillen</Link> — Mollie Pro, refundpad en staging.
          </li>
          <li>
            <Link href="/privacy">Privacy</Link> — cookies, AdSense en accountrechten.
          </li>
          <li>
            <Link href="/account/privacy">Export & verwijdering</Link> — na inloggen.
          </li>
          <li>
            <Link href="/release-gate">Release-gate (staging UAT)</Link> — P0-matrix en sign-off.
          </li>
        </ul>
        <p>
          Productiestatus: <code>/api/health</code> voor databasebereikbaarheid en latency.
        </p>
        <Link href="/">Terug naar homepage</Link>
      </main>
    </>
  );
}
