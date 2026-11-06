import { HomePage } from "@/components/home-page";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";
import { findSport, sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hervat?: string; sport?: string }>;
}) {
  const params = await searchParams;
  const [account, draft] = await Promise.all([readSession(), readDraftCookie()]);
  const requestedSport =
    typeof params.sport === "string" && sports.some((sport) => sport.id === params.sport)
      ? findSport(params.sport).id
      : null;
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
            placeLabel: "Amsterdam",
            period: "Komende 48 uur" as const,
          }
        : baseDraft;

  return (
    <HomePage
      viewerName={account?.name ?? null}
      draft={initialDraft}
      resumed={params.hervat === "1"}
      preselectedSportId={requestedSport}
    />
  );
}
