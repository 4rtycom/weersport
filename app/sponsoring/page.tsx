import type { Metadata } from "next";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { SponsoringForm } from "@/components/sponsoring-form";
import { sports } from "@/lib/sports";
import styles from "./partners.module.css";

export const metadata: Metadata = {
  title: "Sponsoraanvraag",
  description:
    "Stel een sponsorcampagne samen. Je kiest sport, gebied en periode en vraagt een voorstel aan. Beschikbaarheid en prijs stemt WeerSport daarna met je af.",
};

export default function SponsoringPage() {
  const catalog = sports.map((sport) => ({ id: sport.id, name: sport.name }));

  return (
    <div className={styles.page}>
      <SiteHeaderBar />
      <main id="inhoud" className={styles.main}>
        <SponsoringForm sports={catalog} />
      </main>
    </div>
  );
}
