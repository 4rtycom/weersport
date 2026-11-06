import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function AuthGatePage() {
  const account = await readSession();
  const draft = (await readDraftCookie()) ?? account?.draft ?? null;
  if (account?.verified) redirect(draft ? "/auth/hervat" : "/");
  if (account) redirect("/auth/verifieer");

  return (
    <AuthShell>
      <p className="auth-eyebrow">Accountstap</p>
      <h1>{draft ? "Je zoekopdracht is bewaard" : "Je sportmoment staat klaar."}</h1>
      <p className="auth-lead">
        {draft
          ? "Log in of maak een gratis account. Er is nog geen analyse gestart."
          : "Log in of maak een account om jouw weersanalyse te bekijken."}
      </p>
      <div className="auth-draft">
        <p>{draft ? "Bewaarde zoekopdracht" : "Nog geen zoekopdracht"}</p>
        {draft ? (
          <>
            <strong>{draft.sportName}</strong>
            <span>
              {draft.placeLabel} · {draft.period}
            </span>
            <Link className="auth-edit" href="/#planner">
              Wijzig zoekopdracht
            </Link>
          </>
        ) : (
          <>
            <strong>Kies eerst een sport en een Nederlandse plaats</strong>
            <span>De planner op de homepage start nog geen analyse.</span>
            <Link className="auth-edit" href="/#planner">
              Naar de planner
            </Link>
          </>
        )}
      </div>
      <Link className="button button-dark auth-button" href="/auth/inloggen">
        Inloggen en mijn sportmoment bekijken →
      </Link>
      <Link className="button auth-button auth-button-soft" href="/auth/registreren">
        Maak gratis een Basis-account
      </Link>
      <p className="auth-inline-note">Er wordt pas een aanvraag geteld wanneer je de analyse echt start.</p>
    </AuthShell>
  );
}
