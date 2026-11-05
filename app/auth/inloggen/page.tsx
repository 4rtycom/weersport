import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";
import { readDraftCookie, readSession } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ bevestigd?: string; herstel?: string }>;
}) {
  const account = await readSession();
  const draft = (await readDraftCookie()) ?? account?.draft ?? null;
  if (account?.verified) redirect(draft ? "/auth/hervat" : "/");
  if (account) redirect("/auth/verifieer");
  const params = await searchParams;
  return (
    <AuthShell>
      <LoginForm confirmed={params.bevestigd === "1"} restored={params.herstel === "1"} />
    </AuthShell>
  );
}
