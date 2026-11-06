import type { Metadata } from "next";
import { FietsMomentPage } from "@/components/fiets-moment-page";

export const metadata: Metadata = {
  title: "Fietsen in Amsterdam",
  description:
    "Fictief voorbeeld van een volledig WeerSport-moment voor fietsen in Amsterdam, met een gesponsorde vermelding.",
};

export default function SponsoringVoorbeeldPage() {
  return <FietsMomentPage />;
}
