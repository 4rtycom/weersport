import type { Metadata } from "next";
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
      <main id="inhoud">
        <SponsorSignup signupOpen={sponsorFlags().signup} />
      </main>
    </>
  );
}
