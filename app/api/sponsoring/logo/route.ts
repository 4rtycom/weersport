import { NextResponse } from "next/server";
import { storeLogo } from "@/lib/sponsoring/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Het logo moet een PNG, JPEG of WebP tot 1,5 MB zijn." }, { status: 400 });
  }
  const stored = storeLogo(new Uint8Array(await file.arrayBuffer()));
  if (!stored.ok) return NextResponse.json({ ok: false, error: stored.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: stored.id, contentType: stored.contentType, width: stored.width, height: stored.height });
}
