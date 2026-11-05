import { AuthShell } from "@/components/auth-shell";
import { ResetRequestForm } from "@/components/auth-forms";

export const dynamic = "force-dynamic";

export default function ResetPage() {
  return (
    <AuthShell>
      <ResetRequestForm />
    </AuthShell>
  );
}
