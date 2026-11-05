import { HomePage } from "@/components/home-page";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ hervat?: string }> }) {
  const params = await searchParams;
  const [account, draft] = await Promise.all([readSession(), readDraftCookie()]);
  return <HomePage viewerName={account?.name ?? null} draft={draft ?? account?.draft ?? null} resumed={params.hervat === "1"} />;
}
