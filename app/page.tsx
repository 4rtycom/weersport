import { HomePage } from "@/components/home-page";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";
import { findCity, landSports, liveMoment } from "@/lib/live";
import { findSport, sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hervat?: string; sport?: string; plaats?: string }>;
}) {
  const params = await searchParams;
  const [account, draft] = await Promise.all([readSession(), readDraftCookie()]);
  const requestedSport =
    typeof params.sport === "string" && sports.some((sport) => sport.id === params.sport)
      ? findSport(params.sport).id
      : null;
  const requestedCity = typeof params.plaats === "string" ? findCity(params.plaats) : null;
  const baseDraft = draft ?? account?.draft ?? null;
  // Explicit ?sport= wins over an older draft sport; keep place/period when present.
  const initialDraft =
    requestedSport && baseDraft
      ? { ...baseDraft, sportId: requestedSport, sportName: findSport(requestedSport).name }
      : requestedSport
        ? {
            sportId: requestedSport,
            sportName: findSport(requestedSport).name,
            placeId: "",
            placeLabel: requestedCity?.label ?? "Amsterdam",
            period: "Komende 48 uur" as const,
          }
        : baseDraft;

  // The example card shows a real forecast: the chosen sport when it scores on weather alone, otherwise cycling.
  const exampleSport = requestedSport && landSports.some((sport) => sport.id === requestedSport) ? requestedSport : "fietsen";
  const live = await liveMoment(exampleSport, requestedCity?.slug ?? "amsterdam");

  return (
    <HomePage
      live={live}
      preselectedPlaceLabel={requestedSport && requestedCity ? requestedCity.label : null}
      viewerName={account?.name ?? null}
      draft={initialDraft}
      resumed={params.hervat === "1"}
      preselectedSportId={requestedSport}
    />
  );
}
