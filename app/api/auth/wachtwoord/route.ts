import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null;
  const result = resetPassword(body?.token ?? "", body?.password ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ next: "/auth/inloggen?herstel=1" });
}
