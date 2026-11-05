import { cookies } from "next/headers";
import { confirmVerification } from "@/lib/auth/service";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const account = confirmVerification(token);
  const jar = await cookies();
  const session = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  const destination =
    account && session?.id === account.id ? "/auth/hervat" : account ? "/auth/inloggen?bevestigd=1" : "/auth/verifieer?fout=link";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "127.0.0.1:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return Response.redirect(`${proto}://${host}${destination}`);
}
