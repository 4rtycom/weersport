import { randomUUID } from "node:crypto";
import { db } from "@/lib/auth/db";
import { ensureCommercialSchema } from "@/lib/sponsoring/commercial-schema";
import { sponsorFlags } from "@/lib/sponsoring/flags";
import { amsterdamToday } from "@/lib/sponsoring/months";
import { validateDestination } from "@/lib/sponsoring/validate";

export type PublicSponsor = {
  id: string;
  name: string;
  href: string;
  logoUrl: string;
};

export function listPublicSponsors(sportId: string, now = new Date()): PublicSponsor[] {
  if (!sponsorFlags().publish) return [];
  ensureCommercialSchema();
  const day = amsterdamToday(now);
  const rows = db()
    .prepare(
      `SELECT DISTINCT p.id, p.public_name, p.destination_url, p.logo_id
       FROM sponsor_profiles p
       JOIN sponsor_contracts c ON c.sponsor_id = p.id
       JOIN sponsor_contract_sports s ON s.contract_id = c.id
       WHERE p.moderation_status = 'approved'
         AND p.logo_id IS NOT NULL
         AND c.status IN ('active', 'cancel_scheduled')
         AND c.paid_until > ?
         AND s.sport_id = ?
         AND s.period_start < c.paid_until
       ORDER BY p.public_name COLLATE NOCASE, p.id`,
    )
    .all(day, sportId) as Array<{ id: string; public_name: string; destination_url: string; logo_id: string }>;
  const seen = new Set<string>();
  const sponsors: PublicSponsor[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    let href: string | null = null;
    try {
      href = validateDestination(row.destination_url);
    } catch {
      href = null;
    }
    if (!href) continue;
    seen.add(row.id);
    sponsors.push({
      id: row.id,
      name: row.public_name,
      href,
      logoUrl: `/api/sponsoring/logo/${row.logo_id}`,
    });
  }
  return sponsors;
}

export function moderateSponsor(input: { sponsorId: string; decision: "approved" | "rejected"; reason: string; actor: string }) {
  ensureCommercialSchema();
  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false as const, error: "Leg een reden vast." };
  const row = db().prepare("SELECT id FROM sponsor_profiles WHERE id = ?").get(input.sponsorId) as { id: string } | undefined;
  if (!row) return { ok: false as const, error: "Sponsor niet gevonden." };
  const stamp = new Date().toISOString();
  db()
    .prepare("UPDATE sponsor_profiles SET moderation_status = ?, moderation_reason = ?, updated_at = ? WHERE id = ?")
    .run(input.decision, reason, stamp, input.sponsorId);
  db()
    .prepare("INSERT INTO sponsor_audit (id, actor, action, subject, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), input.actor, `moderation_${input.decision}`, input.sponsorId, reason, stamp);
  return { ok: true as const };
}
