import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (!account.verified) redirect("/auth/verifieer");
  const draft = (await readDraftCookie()) ?? account.draft;

  return (
    <AuthShell>
      <p className="auth-eyebrow">Account</p>
      <h1>Je zoekopdracht is bewaard</h1>
      <p className="auth-lead">
        {draft
          ? "Hieronder staan je drie keuzes. Bewerken of inloggen heeft nog geen analyse gestart."
          : "Er is nog geen bewaarde zoekopdracht."}
      </p>
      <div className="auth-draft auth-draft-tall">
        <p>Account geverifieerd</p>
        {draft ? (
          <>
            <strong>{draft.sportName}</strong>
            <span>{draft.placeLabel}</span>
            <span>{draft.period}</span>
            <Link className="auth-edit-draft" href={`/?sport=${draft.sportId}&hervat=1#planner`}>
              Bewerk zoekopdracht
            </Link>
          </>
        ) : (
          <>
            <strong>Kies een sport en een Nederlandse plaats</strong>
            <span>De planner op de homepage verbruikt nog niets.</span>
          </>
        )}
        <small>Een analyse start pas wanneer je dat expliciet bevestigt op het resultaatscherm.</small>
      </div>
      <Link className="button button-dark auth-button" href={draft ? "/moment" : "/#planner"}>
        {draft ? "Ga naar analyse-start →" : "Naar de planner →"}
      </Link>
      <Link className="button auth-button auth-button-soft" href="/account">
        Mijn account
      </Link>
    </AuthShell>
  );
}
