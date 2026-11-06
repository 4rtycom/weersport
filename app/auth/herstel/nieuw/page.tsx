import { AuthShell } from "@/components/auth-shell";
import { NewPasswordForm } from "@/components/auth-forms";

export const dynamic = "force-dynamic";

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <AuthShell>
      {params.token ? (
        <NewPasswordForm token={params.token} />
      ) : (
        <>
          <p className="auth-eyebrow">Account / reset</p>
          <h1>Deze herstel-link is ongeldig.</h1>
          <p className="auth-lead">Vraag een nieuwe link aan. De vorige link is niet bruikbaar.</p>
        </>
      )}
    </AuthShell>
  );
}
