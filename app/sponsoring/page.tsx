import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SponsorSignup } from "@/components/sponsor-signup";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { sponsorFlags } from "@/lib/sponsoring/flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Word sportsponsor",
  description: "Kies sporten, controleer het maandbedrag en betaal de eerste termijn met iDEAL.",
};

export default function SponsoringPage() {
  return (
    <>
      <SiteHeaderBar />
      <main id="inhoud" className="page">
        <PageHero
          eyebrow="Word sportsponsor"
          title="Sponsor een sport, in heel Nederland"
          lead="Eén vast maandbedrag per sport, één contract en één factuur per periode. De eerste termijn betaal je met iDEAL; daarna stuurt WeerSport elke periode een factuur via Mollie. Sponsoring heeft nooit invloed op de weerscore."
        />
        <div className="page-body">
          <SponsorSignup signupOpen={sponsorFlags().signup} />
        </div>
      </main>
    </>
  );
}
