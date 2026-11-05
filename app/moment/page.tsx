import { redirect } from "next/navigation";
import { MomentView } from "@/components/moment-view";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";
import { buildForecastSnapshot } from "@/lib/data/snapshot";

export const dynamic = "force-dynamic";
export const metadata = { title: "WeerSport-moment" };

export default async function MomentPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (!account.verified) redirect("/auth/verifieer");
  const draft = (await readDraftCookie()) ?? account.draft;
  if (!draft) redirect("/#planner");

  try {
    const snapshot = await buildForecastSnapshot(draft);
    return <MomentView snapshot={snapshot} accountName={account.name} />;
  } catch {
    return (
      <main className="moment" id="inhoud">
        <h1>Bronnen niet bereikbaar</h1>
        <p>
          De plaats of de weeradapter kon niet worden geladen. Er is geen score, geen veiligheidsclaim en geen
          analyse geboekt.
        </p>
      </main>
    );
  }
}
