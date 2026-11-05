import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { DeleteMomentButton, OpenMomentButton } from "@/components/account/moment-list-actions";
import { SportIcon } from "@/components/sport-icon";
import { readSession } from "@/lib/auth/cookies";
import { ageLabel, listPlannedMoments, nextPlannedMoment } from "@/lib/moments/store";
import { findSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function MomentsPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const moments = listPlannedMoments(account.id);
  const featured = nextPlannedMoment(moments);

  return (
    <AccountShell active="momenten" accountName={account.name} breadcrumb="Mijn WeerSport / Sportmomenten">
      <p className="eyebrow">Jouw persoonlijke sportweer-overzicht</p>
      <div className="account-heading-row">
        <div>
          <h1>Mijn sportmomenten</h1>
          <p className="account-lead">
            Bewaar jouw sportplannen, bekijk ze opnieuw en kies wanneer je een nieuwe voorspelling wilt ophalen.
          </p>
        </div>
        <Link className="button button-dark" href="/#planner">
          + Nieuw sportmoment
        </Link>
      </div>

      {featured ? (
        <section className="account-hero-card">
          <p className="account-chip">Mijn volgende</p>
          <h2>
            {featured.sportName} · {featured.windowLabel}
          </h2>
          <p>
            {featured.placeLabel} · {formatWindow(featured.plannedStart, featured.plannedEnd)}
          </p>
          <p className="account-disclaimer">
            Opgeslagen plan, geen live weersadvies. Controleer de voorspelling opnieuw voordat je vertrekt. Dit is geen
            live veiligheidsgarantie.
          </p>
          <p className="account-age">
            Analyseleeftijd: {ageLabel(featured.lastSnapshotAt)}
            {featured.lastScoreLabel ? ` · laatst gezien als ${featured.lastScoreLabel}` : ""}
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="account-section-title">Geplande momenten</h2>
        <p className="account-section-copy">
          Een sportmoment heeft een geplande datum en tijd. De weerscore kan veranderen.
        </p>
        {moments.length === 0 ? (
          <div className="account-panel">
            <p>Nog geen geplande momenten. Opslaan kost 0 aanvragen.</p>
            <Link className="button button-lime" href="/#planner">
              Plan je eerste moment →
            </Link>
          </div>
        ) : (
          <ul className="account-card-grid">
            {moments.map((moment) => {
              const sport = findSport(moment.sportId);
              return (
                <li key={moment.id} className="account-item-card">
                  <div className="account-item-head">
                    <span className="icon-badge icon-badge-lg">
                      <SportIcon src={sport.icon} size={28} />
                    </span>
                    <div>
                      <h3>{moment.sportName}</h3>
                      <p>
                        {moment.placeLabel} · {formatWindow(moment.plannedStart, moment.plannedEnd)}
                      </p>
                    </div>
                  </div>
                  <p className="account-tag">Plan opgeslagen</p>
                  <p className="account-age">Leeftijd gekoppelde analyse: {ageLabel(moment.lastSnapshotAt)}</p>
                  <p className="account-disclaimer">{moment.note || "Geen live veiligheidsgarantie."}</p>
                  <div className="account-item-actions">
                    <OpenMomentButton id={moment.id} />
                    <DeleteMomentButton id={moment.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
