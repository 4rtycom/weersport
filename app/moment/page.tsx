import Link from "next/link";
import { redirect } from "next/navigation";
import { MomentView } from "@/components/moment-view";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";
import { resolveAdPlacement } from "@/lib/ads/server";
import { resolveCommercialBlocks } from "@/lib/affiliate/select";
import { runMeteredAnalysis } from "@/lib/billing/analysis";
import { saveDraft } from "@/lib/auth/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "WeerSport-moment" };

export default async function MomentPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (!account.verified) redirect("/auth/verifieer");
  const draft = (await readDraftCookie()) ?? account.draft;
  if (!draft) redirect("/#planner");

  const result = await runMeteredAnalysis({ userId: account.id, draft });
  if (!result.ok) {
    if (result.status === 402) {
      return (
        <>
          <SiteHeaderBar account />
          <main className="moment" id="inhoud">
            <p className="eyebrow">Quota</p>
            <h1>Maandelijks analyselimiet bereikt</h1>
            <p>{result.error}</p>
            <p>
              Gebruikt {result.entitlement.used}/{result.entitlement.limit}. Opgeslagen plannen blijven beschikbaar.
            </p>
            <div className="account-item-actions" style={{ marginTop: 18 }}>
              <Link className="button button-lime" href="/checkout/pro">
                Upgrade naar Pro
              </Link>
              <Link className="button button-dark" href="/account/momenten">
                Bekijk opgeslagen momenten
              </Link>
            </div>
          </main>
        </>
      );
    }
    return (
      <>
        <SiteHeaderBar account />
        <main className="moment" id="inhoud">
          <h1>Bronnen niet bereikbaar</h1>
          <p>{result.error}</p>
        </main>
      </>
    );
  }

  saveDraft(account.id, draft);
  const ads = await resolveAdPlacement({
    surface: "moment",
    suitabilityKind: result.snapshot.suitability.kind,
    userId: account.id,
  });
  let commercialBlocks: ReturnType<typeof resolveCommercialBlocks> = { affiliate: null, sponsors: [] };
  try {
    commercialBlocks = resolveCommercialBlocks({
      surface: "moment",
      plan: ads.plan,
      snapshot: result.snapshot,
    });
  } catch {
    commercialBlocks = { affiliate: null, sponsors: [] };
  }
  return (
    <MomentView
      snapshot={result.snapshot}
      accountName={account.name}
      entitlement={result.entitlement}
      booking={{ booked: result.booked, consumed: result.consumed, cacheHit: result.cacheHit }}
      ads={ads}
      commercialBlocks={commercialBlocks}
      consentGranted={ads.consent.granted}
    />
  );
}
