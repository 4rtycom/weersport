import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { PrivacyActions } from "@/components/account/privacy-actions";
import { readSession } from "@/lib/auth/cookies";
import { getEntitlement } from "@/lib/billing/entitlement";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy & data" };

export default async function AccountPrivacyPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const entitlement = getEntitlement(account.id);

  return (
    <AccountShell
      active="privacy"
      accountName={account.name}
      breadcrumb="Mijn WeerSport / Privacy & data"
      planLabel={`${entitlement.plan === "pro" ? "Pro" : "Basis"} · ${entitlement.used}/${entitlement.limit}`}
    >
      <>
        <p className="eyebrow">AVG · export & verwijdering</p>
        <div className="account-heading-row">
          <div>
            <h1>Privacy & data</h1>
            <p className="account-lead">
              Exporteer of verwijder je persoonsgegevens. Wachtwoorden staan nooit in exports. Productie-fiscaliteit
              voor facturen volgt nog een aparte bewaarplicht.
            </p>
          </div>
        </div>
        <PrivacyActions />
      </>
    </AccountShell>
  );
}
