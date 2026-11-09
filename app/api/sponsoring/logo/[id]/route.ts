import { NextResponse } from "next/server";
import { logoIsPublic, readLogo } from "@/lib/sponsoring/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!logoIsPublic(id)) return NextResponse.json({ error: "Logo niet gevonden." }, { status: 404 });
  const logo = readLogo(id);
  if (!logo) return NextResponse.json({ error: "Logo niet gevonden." }, { status: 404 });
  return new NextResponse(new Uint8Array(logo.body), {
    headers: {
      "content-type": logo.contentType,
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=300",
    },
  });
}
