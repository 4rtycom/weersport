import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountFromSession } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { getPreferences, updatePreferences } from "@/lib/moments/store";
import { PHASE05_BOOKING } from "@/lib/moments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAccount() {
  const jar = await cookies();
  const account = accountFromSession(jar.get(SESSION_COOKIE)?.value);
  if (!account) return { error: NextResponse.json({ error: "Log in om voorkeuren te bewaren.", ...PHASE05_BOOKING }, { status: 401 }) };
  if (!account.verified) {
    return {
      error: NextResponse.json(
        { error: "Verifieer eerst je e-mailadres.", next: "/auth/verifieer", ...PHASE05_BOOKING },
        { status: 403 },
      ),
    };
  }
  return { account };
}

export async function GET() {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ preferences: getPreferences(auth.account.id), ...PHASE05_BOOKING });
}

export async function POST(request: Request) {
  const auth = await requireAccount();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const preferences = updatePreferences(auth.account.id, {
    weekendFocus: typeof body?.weekendFocus === "boolean" ? body.weekendFocus : undefined,
    uvReminders: typeof body?.uvReminders === "boolean" ? body.uvReminders : undefined,
    savePlansByDefault: typeof body?.savePlansByDefault === "boolean" ? body.savePlansByDefault : undefined,
  });
  return NextResponse.json({ preferences, ...PHASE05_BOOKING });
}
