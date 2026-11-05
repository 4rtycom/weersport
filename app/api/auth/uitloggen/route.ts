import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, clearSession } from "@/lib/auth/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const jar = await cookies();
  const response = NextResponse.json({ next: "/" });
  clearSession(response, request, jar.get(SESSION_COOKIE)?.value);
  return response;
}
