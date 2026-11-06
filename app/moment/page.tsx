import { redirect } from "next/navigation";
import { MomentView } from "@/components/moment-view";
import { StartAnalysis } from "@/components/start-analysis";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";
import { resolveAdPlacement } from "@/lib/ads/server";
import { peekMeteredAnalysis, runMeteredAnalysis } from "@/lib/billing/analysis";
import { hourBucketKey } from "@/lib/billing/period";
import { saveDraft } from "@/lib/auth/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "WeerSport-moment" };

export default async function MomentPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (!account.verified) redirect("/auth/verifieer");
  const draft = (await readDraftCookie()) ?? account.draft;
  if (!draft) redirect("/#planner");

  const params = await searchParams;
  // Optional one-shot server start for scripted checks: /moment?start=1
  // Still goes through runMeteredAnalysis (POST semantics), not a silent GET book.
  // The hour bucket matches the analysis fingerprint, so the next Amsterdam hour books again.
  if (params.start === "1") {
    const started = await runMeteredAnalysis({
      userId: account.id,
      draft,
      idempotencyKey: `page-start:${account.id}:${draft.sportId}:${draft.placeId}:${draft.period}:${hourBucketKey()}`,
    });
    if (started.ok) {
      saveDraft(account.id, draft);
      const ads = await resolveAdPlacement({
        surface: "moment",
        suitabilityKind: started.snapshot.suitability.kind,
        userId: account.id,
      });
      return (
        <MomentView
          snapshot={started.snapshot}
          accountName={account.name}
          entitlement={started.entitlement}
          booking={{
            booked: started.booked,
            consumed: started.consumed,
            cacheHit: started.cacheHit,
          }}
          ads={ads}
        />
      );
    }
    if (started.status === 503) {
      return (
        <main className="moment" id="inhoud">
          <h1>Bronnen niet bereikbaar</h1>
          <p>{started.error}</p>
        </main>
      );
    }
  }

  const peeked = peekMeteredAnalysis({ userId: account.id, draft });
  if (peeked.ok) {
    const ads = await resolveAdPlacement({
      surface: "moment",
      suitabilityKind: peeked.snapshot.suitability.kind,
      userId: account.id,
    });
    return (
      <MomentView
        snapshot={peeked.snapshot}
        accountName={account.name}
        entitlement={peeked.entitlement}
        booking={{ booked: false, consumed: 0, cacheHit: true }}
        ads={ads}
      />
    );
  }

  // Exhausted users can still POST to load safety/UV without a scored charge.
  return (
    <StartAnalysis
      draft={draft}
      entitlement={peeked.entitlement}
      quotaExhausted={peeked.quotaExhausted}
    />
  );
}
