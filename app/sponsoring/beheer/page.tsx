import { PageHero } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { ManagePanel } from "@/components/sponsor-manage";
import { manageView, sponsorIdForToken } from "@/lib/sponsoring/manage";
import styles from "../signup.module.css";

export const dynamic = "force-dynamic";

export default async function SponsorManagePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const sponsorId = sponsorIdForToken(token);
  const view = sponsorId ? manageView(sponsorId) : null;
  return (
    <>
      <SiteHeaderBar />
      <main id="inhoud" className={`page ${styles.manage}`}>
        <PageHero eyebrow="Sportsponsoring" title="Je sportsponsoring beheren" />
        <div className="page-body page-body-narrow">
          {!view ? (
            <section className={styles.card}>
              <p className={styles.error} role="alert">
                Deze beheerverwijzing is ongeldig of verlopen. Gebruik de link uit je laatste e-mail van WeerSport.
              </p>
            </section>
          ) : (
            <ManagePanel token={token} view={view} />
          )}
        </div>
      </main>
    </>
  );
}
