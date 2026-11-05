import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LogoutButton } from "@/components/logout-button";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  const draft = (await readDraftCookie()) ?? account.draft;

  return (
    <AuthShell>
      <p className="auth-eyebrow">Account</p>
      <h1>Mijn account</h1>
      <p className="auth-lead">Basis-account. Abonnement, quota en advertenties horen bij een latere fase.</p>
      <div className="auth-draft auth-draft-tall">
        <p>{account.verified ? "Account geverifieerd · Basis" : "E-mail nog niet geverifieerd · Basis"}</p>
        <strong>{account.name}</strong>
        <span>{account.email}</span>
        {draft ? (
          <small>
            Bewaarde zoekopdracht: {draft.sportName} in {draft.placeLabel} · {draft.period}. Er is geen analyse geboekt.
          </small>
        ) : (
          <small>Er is nog geen zoekopdracht bewaard.</small>
        )}
      </div>
      {account.verified ? (
        <Link className="button button-dark auth-button" href={draft ? "/auth/hervat" : "/#planner"}>
          Terug naar je sportmoment
        </Link>
      ) : (
        <Link className="button button-dark auth-button" href="/auth/verifieer">
          E-mailadres verifiëren
        </Link>
      )}
      <LogoutButton />
    </AuthShell>
  );
}
