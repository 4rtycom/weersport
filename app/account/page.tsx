import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { LogoutButton } from "@/components/logout-button";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { ensureBasisSubscription, getEntitlement } from "@/lib/billing/entitlement";
import { ageLabel, listFavoriteSports, listPlannedMoments, listSavedSearches } from "@/lib/moments/store";
import { findSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  ensureBasisSubscription(account.id);
  const entitlement = getEntitlement(account.id);

  const moments = listPlannedMoments(account.id);
  const searches = listSavedSearches(account.id);
  const favorites = listFavoriteSports(account.id);
  const nextMoment = moments[0] ?? null;

  return (
    <AccountShell
      active="overview"
      accountName={account.name}
      breadcrumb="Mijn WeerSport / Overzicht"
      planLabel={`${entitlement.plan === "pro" ? "Pro" : "Basis"} · ${entitlement.used}/${entitlement.limit}`}
    >
      <p className="eyebrow">Jouw persoonlijke sportweer-overzicht</p>
      <div className="account-heading-row">
        <div>
          <h1>Mijn omgeving</h1>
          <p className="account-lead">
            Plannen en filters bewaren kost geen analyse. Een nieuwe score start pas wanneer jij dat vraagt.
          </p>
        </div>
        <Link className="button button-dark" href="/#planner">
          + Nieuw sportmoment
        </Link>
      </div>

      {nextMoment ? (
        <section className="account-hero-card">
          <p className="account-chip">Mijn volgende</p>
          <h2>
            {nextMoment.sportName} · {nextMoment.windowLabel}
          </h2>
          <p>
            {nextMoment.placeLabel} · {formatWindow(nextMoment.plannedStart, nextMoment.plannedEnd)}
          </p>
          <p className="account-disclaimer">
            Opgeslagen plan, geen live weersadvies of veiligheidsgarantie. Controleer de voorspelling opnieuw
            voordat je vertrekt.
          </p>
          <p className="account-age">Analyseleeftijd: {ageLabel(nextMoment.lastSnapshotAt)}</p>
          <Link className="button button-lime" href="/account/momenten">
            Bekijk sportmomenten →
          </Link>
        </section>
      ) : (
        <section className="account-hero-card">
          <p className="account-chip">Nog leeg</p>
          <h2>Bewaar je eerste sportmoment</h2>
          <p>Filters en plannen opslaan verbruikt geen Basis-aanvraag.</p>
          <Link className="button button-lime" href="/#planner">
            Start met plannen →
          </Link>
        </section>
      )}

      <div className="account-summary-grid">
        <article className="account-panel">
          <h2>Geplande momenten</h2>
          <strong>{moments.length}</strong>
          <Link href="/account/momenten">Bekijk plannen</Link>
        </article>
        <article className="account-panel">
          <h2>Opgeslagen filters</h2>
          <strong>{searches.length}</strong>
          <Link href="/account/zoekopdrachten">Bekijk zoekopdrachten</Link>
        </article>
        <article className="account-panel">
          <h2>Favoriete sporten</h2>
          <strong>{favorites.length}</strong>
          <div className="account-fav-row">
            {favorites.slice(0, 4).map((sport) => (
              <span key={sport.id} className="icon-badge" title={sport.name}>
                <SportIcon src={sport.icon} size={22} />
              </span>
            ))}
            {favorites.length === 0 ? <span>Nog geen favorieten</span> : null}
          </div>
          <Link href="/account/sporten">Beheer sporten</Link>
        </article>
      </div>

      <section className="account-panel account-quota-stub">
        <h2>
          {entitlement.plan === "pro" ? "Pro" : "Basis"} · {entitlement.used}/{entitlement.limit} analyses
        </h2>
        <p>
          Opslaan van plannen/filters blijft 0. Nieuwe succesvolle analyses tellen server-side. Account:{" "}
          {account.verified ? "geverifieerd" : "nog niet geverifieerd"}.
        </p>
        <p className="account-email">{account.email}</p>
        {account.draft ? (
          <p>
            Laatste draft: {findSport(account.draft.sportId).name} in {account.draft.placeLabel}.
          </p>
        ) : null}
        <div className="account-item-actions">
          <Link className="button button-lime" href="/account/abonnement">
            Bekijk quota
          </Link>
          <LogoutButton />
        </div>
      </section>
    </AccountShell>
  );
}

function formatWindow(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
  return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`;
}
