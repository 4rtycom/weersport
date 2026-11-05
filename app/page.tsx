import { HomePage } from "@/components/home-page";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";
import { sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hervat?: string; sport?: string }>;
}) {
  const params = await searchParams;
  const [account, draft] = await Promise.all([readSession(), readDraftCookie()]);
  const sportFromQuery = sports.find((sport) => sport.id === params.sport)?.id ?? null;
  return (
    <HomePage
      viewerName={account?.name ?? null}
      draft={draft ?? account?.draft ?? null}
      resumed={params.hervat === "1"}
      initialSportId={sportFromQuery}
    />
  );
}
