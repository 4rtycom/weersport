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
      <main id="inhoud" className={styles.main}>
        <p className={styles.kicker}>Beheer</p>
        <h1>Je sportsponsoring</h1>
        {!view ? <p className={styles.error} role="alert">Deze beheerverwijzing is ongeldig of verlopen.</p> : <ManagePanel token={token} view={view} />}
      </main>
    </>
  );
}
