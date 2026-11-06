import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth-shell";
import { MAIL_COOKIE } from "@/lib/auth/cookies";
import { authIsClosed, authUsesMailbox, CLOSED_RECOVERY_MESSAGE } from "@/lib/auth/release";

export const dynamic = "force-dynamic";

export default async function ResetSentPage() {
  const closed = authIsClosed();
  const mailbox = authUsesMailbox();
  const jar = await cookies();
  const mailPath = mailbox ? jar.get(MAIL_COOKIE)?.value ?? "" : "";
  const link = mailPath.startsWith("/auth/herstel/nieuw?token=") ? mailPath : null;
  return (
    <AuthShell>
      <p className="auth-eyebrow">Account / verify</p>
      <h1>Herstelmail verstuurd.</h1>
      <p className="auth-lead">
        {closed
          ? CLOSED_RECOVERY_MESSAGE
          : "Als dit adres een account heeft, ontvang je een beveiligde link. Bekende en onbekende adressen zien deze zelfde bevestiging."}
      </p>
      <div className="auth-panel">
        <h2>Herstelmail verstuurd</h2>
        <p>
          {closed
            ? "Er wordt geen herstel-token in deze browser gezet."
            : "Open de link in je mailbox. Je zoekopdracht (sport, locatie, periode) blijft bewaard."}
        </p>
      </div>
      <Link className="button button-dark auth-button" href="/auth/herstel">
        Opnieuw versturen
      </Link>
      <Link className="button auth-button auth-button-soft" href="/auth/inloggen">
        Terug naar inloggen
      </Link>
      {mailbox && link ? (
        <p className="auth-dev-mail">
          Lokale ontwikkelmailbox: <Link href={link}>Open de herstel-link</Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
