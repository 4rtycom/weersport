import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";

export const metadata = { title: "Pagina niet gevonden" };

export default function NotFound() {
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero eyebrow="404" title="Deze pagina bestaat niet" lead="De link is oud of er zit een typfout in het adres." />
        <div className="page-body page-body-narrow">
          <section className="page-card">
            <h2>Waar wil je heen?</h2>
            <div className="status-actions">
              <Link className="button button-lime" href="/#planner">
                Zoek een sportmoment
              </Link>
              <Link className="button button-ghost" href="/sporten">
                Bekijk alle sporten
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
