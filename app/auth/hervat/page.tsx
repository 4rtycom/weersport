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
      <h1>Je bent ingelogd!</h1>
      <p className="auth-lead">
        {draft ? "Je bewaarde zoekopdracht staat klaar." : "Er is nog geen bewaarde zoekopdracht."}
      </p>
      <div className="auth-draft auth-draft-tall">
        <p>Je zoekopdracht</p>
        {draft ? (
          <>
            <strong>{`${draft.sportName} in ${draft.placeLabel}`}</strong>
            <span>{draft.period} · bewaarde zoekvoorkeuren</span>
          </>
        ) : (
          <>
            <strong>Kies een sport en een Nederlandse plaats</strong>
            <span>De planner op de homepage verbruikt nog niets.</span>
          </>
        )}
        <small>Het advies openen telt als één analyse.</small>
      </div>
      <Link className="button button-dark auth-button" href={draft ? "/moment" : "/#planner"}>
        Bekijk mijn sportmoment →
      </Link>
      <Link className="button auth-button auth-button-soft" href="/account">
        Mijn account
      </Link>
    </AuthShell>
  );
}
