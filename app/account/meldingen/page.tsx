import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { AlertsPanel } from "@/components/account/alerts-panel";
import { readSession } from "@/lib/auth/cookies";
import { resendConfigured } from "@/lib/alerts/resend";
import { listAlerts } from "@/lib/alerts/store";
import { vapidConfigured } from "@/lib/alerts/webpush";
import { findSport } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meldingen" };

export default async function AlertsPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const alerts = listAlerts(account.id).map((alert) => ({
    id: alert.id,
    sportName: findSport(alert.sportId).name,
    sportIcon: findSport(alert.sportId).icon,
    placeLabel: alert.placeLabel,
    minScore: alert.minScore,
    days: alert.days,
    email: alert.email,
    push: alert.push,
    active: alert.active,
    lastNotifiedAt: alert.lastNotifiedAt,
  }));
  return (
    <AccountShell active="meldingen" accountName={account.name} breadcrumb="Mijn WeerSport / Meldingen">
      <div className="account-heading-row">
        <div>
          <h1>Meldingen</h1>
          <p className="account-lead">
            Krijg elke ochtend bericht als er de komende twee dagen een goed moment aankomt voor jouw sport en plek.
            Meldingen kosten geen analyses.
          </p>
        </div>
        <Link className="button button-dark" href="/#planner">
          + Nieuwe melding
        </Link>
      </div>
      <AlertsPanel
        initialAlerts={alerts}
        email={account.email}
        emailReady={resendConfigured()}
        pushReady={vapidConfigured()}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? ""}
      />
    </AccountShell>
  );
}
