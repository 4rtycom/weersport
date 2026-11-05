import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const account = await readSession();
  const draft = (await readDraftCookie()) ?? account?.draft ?? null;
  if (account?.verified) redirect(draft ? "/auth/hervat" : "/");
  if (account) redirect("/auth/verifieer");
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
