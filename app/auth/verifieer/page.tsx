import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { VerifyActions } from "@/components/auth-forms";
import { MAIL_COOKIE, readSession } from "@/lib/auth/cookies";
import { authIsClosed } from "@/lib/auth/release";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ fout?: string }> }) {
  const account = await readSession();
  if (!account) redirect("/auth/inloggen");
  if (account.verified) redirect("/auth/hervat");
  const params = await searchParams;
  const closed = authIsClosed();
  const jar = await cookies();
  const mailPath = closed ? null : jar.get(MAIL_COOKIE)?.value ?? null;
  const link = mailPath?.startsWith("/auth/verifieer/bevestig?token=") ? mailPath : null;
  return (
    <AuthShell>
      {params.fout === "link" ? (
        <p className="auth-error" role="alert">
          Deze verificatielink is ongeldig of verlopen. Vraag een nieuwe mail aan.
        </p>
      ) : null}
      <VerifyActions email={account.email} mailPath={link} authClosed={closed} />
    </AuthShell>
  );
}
