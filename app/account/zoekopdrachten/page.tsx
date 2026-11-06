import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { DeleteSearchButton, OpenSearchButton } from "@/components/account/moment-list-actions";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { ageLabel, listSavedSearches } from "@/lib/moments/store";
import { findSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const searches = listSavedSearches(account.id);

  return (
    <AccountShell active="zoekopdrachten" accountName={account.name} breadcrumb="Mijn WeerSport / Zoekopdrachten">
      <p className="eyebrow">Opgeslagen filters</p>
      <div className="account-heading-row">
        <div>
          <h1>Opgeslagen zoekopdrachten</h1>
          <p className="account-lead">Filters bewaren kost geen aanvraag. Opnieuw berekenen kan dat later wel.</p>
        </div>
        <Link className="button button-dark" href="/#planner">
          Nieuwe zoekopdracht
        </Link>
      </div>

      {searches.length === 0 ? (
        <div className="account-panel">
          <p>Nog geen bewaarde filters.</p>
          <Link className="button button-lime" href="/#planner">
            Bewaar je eerste filter via een sportmoment →
          </Link>
        </div>
      ) : (
        <ul className="account-card-grid">
          {searches.map((search) => {
            const sport = findSport(search.sportId);
            return (
              <li key={search.id} className="account-item-card">
                <div className="account-item-head">
                  <span className="icon-badge icon-badge-lg">
                    <SportIcon src={sport.icon} size={28} />
                  </span>
                  <div>
                    <h3>
                      {search.sportName} · {search.placeLabel}
                    </h3>
                    <p>
                      {search.period} · bewaarde zoekfilters
                    </p>
                  </div>
                </div>
                <p className={`account-tag ${search.requiresWater ? "is-warn" : ""}`}>
                  {search.requiresWater ? "Water- of ijsdata vereist" : "Opgeslagen"}
                </p>
                <p className="account-age">
                  Laatst geopend: {ageLabel(search.lastOpenedAt)} · bewaard {ageLabel(search.createdAt)}
                </p>
                <div className="account-item-actions">
                  <OpenSearchButton id={search.id} />
                  <DeleteSearchButton id={search.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
