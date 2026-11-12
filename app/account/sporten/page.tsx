import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { FavoriteToggle } from "@/components/account/moment-list-actions";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { listFavoriteSports } from "@/lib/moments/store";
import { sports } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function FavoriteSportsPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const favorites = new Set(listFavoriteSports(account.id).map((sport) => sport.id));

  return (
    <AccountShell active="sporten" accountName={account.name} breadcrumb="Mijn WeerSport / Sporten">
      <div className="account-heading-row">
        <div>
          <h1>Mijn sporten</h1>
          <p className="account-lead">Kies je favoriete sporten. Alleen jij ziet ze, en het kost geen analyses.</p>
        </div>
      </div>
      <ul className="account-card-grid account-card-grid-3">
        {sports.map((sport) => {
          const favorite = favorites.has(sport.id);
          return (
            <li key={sport.id} className="account-item-card">
              <div className="account-item-head">
                <span className="icon-badge icon-badge-lg">
                  <SportIcon src={sport.icon} size={28} />
                </span>
                <div>
                  <h3>{sport.name}</h3>
                  <p>{favorite ? "Een van je favorieten" : "Geen favoriet"}</p>
                </div>
              </div>
              <FavoriteToggle sportId={sport.id} favorite={favorite} />
            </li>
          );
        })}
      </ul>
    </AccountShell>
  );
}
