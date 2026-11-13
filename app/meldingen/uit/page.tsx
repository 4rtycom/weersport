import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, StatusCard } from "@/components/page-hero";
import { SiteHeaderBar } from "@/components/site-header-bar";
import { findAlertByToken } from "@/lib/alerts/store";
import { findSport } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Melding uitzetten", robots: { index: false } };

/** Mail link target. Shows a confirm button instead of unsubscribing on GET, so link scanners cannot switch alerts off. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; klaar?: string }> }) {
  const params = await searchParams;
  const alert = params.token ? findAlertByToken(params.token) : null;
  return (
    <>
      <SiteHeaderBar />
      <main className="page" id="inhoud">
        <PageHero eyebrow="Meldingen" title={params.klaar === "1" ? "Melding uitgezet" : "Melding uitzetten"} />
        <div className="page-body page-body-narrow">
          {params.klaar === "1" ? (
            <StatusCard
              tone="success"
              title="Je krijgt deze melding niet meer"
              actions={
                <Link className="button button-ghost" href="/account/meldingen">
                  Meldingen beheren
                </Link>
              }
            >
              <p>Andere meldingen blijven gewoon aan. Je kunt deze altijd weer aanzetten in je account.</p>
            </StatusCard>
          ) : alert ? (
            <StatusCard tone="neutral" title={`${findSport(alert.sportId).name} in ${alert.placeLabel}`}>
              <p>Wil je geen meldingen meer over deze sport en plek?</p>
              <form method="post" action={`/api/alerts/unsubscribe?token=${encodeURIComponent(params.token ?? "")}`} className="status-actions">
                <button className="button button-dark" type="submit">
                  Ja, zet deze melding uit
                </button>
                <Link className="button button-ghost" href="/account/meldingen">
                  Liever aanpassen
                </Link>
              </form>
            </StatusCard>
          ) : (
            <StatusCard
              tone="error"
              title="Deze link werkt niet meer"
              actions={
                <Link className="button button-dark" href="/account/meldingen">
                  Naar mijn meldingen
                </Link>
              }
            >
              <p>De melding bestaat niet meer of de link is onvolledig. Log in om je meldingen te beheren.</p>
            </StatusCard>
          )}
        </div>
      </main>
    </>
  );
}
