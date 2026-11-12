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
      <h1>Je sportmoment staat klaar.</h1>
      <p className="auth-lead">Log in of maak een account om jouw weersanalyse te bekijken.</p>
      <div className="auth-draft">
        <p>Je zoekopdracht blijft bewaard</p>
        {draft ? (
          <>
            <strong>{draft.sportName}</strong>
            <span>
              {draft.placeLabel} · {draft.period}
            </span>
          </>
        ) : (
          <>
            <strong>Nog geen zoekopdracht</strong>
            <span>Kies eerst een sport en een Nederlandse plaats.</span>
          </>
        )}
      </div>
      <Link className="button button-dark auth-button" href="/auth/inloggen">
        Inloggen
      </Link>
      <Link className="button auth-button auth-button-soft" href="/auth/registreren">
        Gratis account aanmaken
      </Link>
      <p className="auth-inline-note">Je zoekopdracht telt pas als analyse wanneer je het advies opent.</p>
    </AuthShell>
  );
}
