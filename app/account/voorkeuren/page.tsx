import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { PreferencesForm } from "@/components/account/moment-list-actions";
import { readSession } from "@/lib/auth/cookies";
import { ageLabel, getPreferences } from "@/lib/moments/store";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const preferences = getPreferences(account.id);

  return (
    <AccountShell active="voorkeuren" accountName={account.name} breadcrumb="Mijn WeerSport / Voorkeuren">
      <p className="eyebrow">Persoonlijke voorkeuren</p>
      <div className="account-heading-row">
        <div>
          <h1>Voorkeuren</h1>
          <p className="account-lead">
            Instellingen bewaren kost geen analyse. Versiebeheer: wijzigingen blijven bij dit Basis-account.
          </p>
        </div>
      </div>
      <section className="account-panel">
        <p className="account-age">Laatst bijgewerkt: {ageLabel(preferences.updatedAt)}</p>
        <PreferencesForm
          initial={{
            weekendFocus: preferences.weekendFocus,
            uvReminders: preferences.uvReminders,
            savePlansByDefault: preferences.savePlansByDefault,
          }}
        />
      </section>
      <section className="account-panel">
        <h2>Privacy &amp; versiebeheer</h2>
        <p>
          Favorieten, filters en plannen staan op jouw account. Plannen zijn geen live veiligheidsgarantie. Oude
          analyses tonen hun leeftijd en vervangen nooit een actuele broncontrole.
        </p>
      </section>
    </AccountShell>
  );
}
