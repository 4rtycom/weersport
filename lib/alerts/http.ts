import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { accountFromSession, type Account } from "@/lib/auth/service";

export async function requireVerifiedAccount(): Promise<{ account: Account } | { error: NextResponse }> {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return { error: NextResponse.json({ error: "Log in om meldingen te beheren." }, { status: 401 }) };
  if (!account.verified) {
    return { error: NextResponse.json({ error: "Verifieer eerst je e-mailadres.", next: "/auth/verifieer" }, { status: 403 }) };
  }
  return { account };
}
