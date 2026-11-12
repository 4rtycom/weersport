import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth-shell";
import { MAIL_COOKIE } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function ResetSentPage() {
  const jar = await cookies();
  const mailPath = jar.get(MAIL_COOKIE)?.value ?? "";
  const link = mailPath.startsWith("/auth/herstel/nieuw?token=") ? mailPath : null;
  return (
    <AuthShell>
      <h1>Herstelmail verstuurd.</h1>
      <p className="auth-lead">Gebruik de link in je mailbox om veilig een nieuw wachtwoord in te stellen.</p>
      <div className="auth-panel">
        <h2>Herstelmail verstuurd</h2>
        <p>
          Open de link in je mailbox. Als je al een zoekopdracht had gekozen, blijft die sport, locatie en periode
          bewaard.
        </p>
      </div>
      <Link className="button button-dark auth-button" href="/auth/herstel">
        Opnieuw versturen
      </Link>
      <Link className="button auth-button auth-button-soft" href="/auth/inloggen">
        Terug naar inloggen
      </Link>
      {link ? (
        <p className="auth-dev-mail">
          Er is geen mailserver gekoppeld. Dezelfde herstelroute staat in deze ontwikkelmailbox:{" "}
          <Link href={link}>Open de herstel-link</Link>
        </p>
      ) : (
        <p className="auth-dev-mail">
          Als dit adres een account heeft, staat de link in de mailbox. Zonder gekoppelde mailserver zie je die link
          alleen in de browser waarmee je de aanvraag deed.
        </p>
      )}
    </AuthShell>
  );
}
