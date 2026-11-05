import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, clearSession } from "@/lib/auth/cookies";
import { accountFromSession } from "@/lib/auth/service";
import { deleteAccount } from "@/lib/account/privacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const account = accountFromSession(token);
  if (!account) {
    return NextResponse.json({ error: "Log in om je account te verwijderen." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { password?: string; confirm?: string } | null;
  if (body?.confirm !== "VERWIJDER") {
    return NextResponse.json(
      { error: "Typ VERWIJDER om permanente verwijdering te bevestigen." },
      { status: 400 },
    );
  }
  if (!body.password) {
    return NextResponse.json({ error: "Wachtwoord is verplicht." }, { status: 400 });
  }
  const result = deleteAccount(account.id, body.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const response = NextResponse.json({ ok: true, message: result.message });
  clearSession(response, request, token);
  return response;
}
