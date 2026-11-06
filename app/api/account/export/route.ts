import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { accountFromSession } from "@/lib/auth/service";
import { exportAccountData } from "@/lib/account/privacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) {
    return NextResponse.json({ error: "Log in om je gegevens te exporteren." }, { status: 401 });
  }
  const payload = exportAccountData(account.id);
  if (!payload) {
    return NextResponse.json({ error: "Account niet gevonden." }, { status: 404 });
  }
  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="weersport-export-${account.id.slice(0, 8)}.json"`,
      "cache-control": "no-store",
    },
  });
}
