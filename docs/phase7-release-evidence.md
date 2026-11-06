# Phase 7 — Release evidence and rollback

Depends on Phases 0–6. **No deploy, DNS change, Mollie purchase or production GO** in this PR. Glenn owns sign-off.

Legacy **Phase 08** (`/release-gate`, `check-phase08`) remains the Figma H06 UAT matrix UI. This phase packages ops evidence, allowlisted staging journeys, independent kill switches and a recovery/billing-safe rollback runbook.

## Kill switches (independent)

| Capability | Env | Effect |
|---|---|---|
| Registration / recovery delivery | `WEERSPORT_FORCE_AUTH_CLOSED=1` | Auth closed (Phase 0) |
| Live recommendations / SCORED | `WEERSPORT_RECOMMENDATIONS_DISABLED=1` | Forces `NO_SCORE`; **UV + warnings stay** |
| Checkout / Pro | `WEERSPORT_BILLING_DISABLED=1` or invalid Mollie key | Checkout refused (Phase 5) |

Health exposes `checks.capabilities.{registration,recommendations,checkout}`.

## Staging-only integration

Destructive suites require `WEERSPORT_BASE_URL` on an **allowlisted** disposable host:

- loopback (`localhost`, `127.0.0.1`)
- `*.vercel.app` previews (**not** `weersport.vercel.app`)
- or hosts listed in `WEERSPORT_CHECK_ALLOWLIST`

Blocked: `weersport.vercel.app`, `weersport.nl`, `www.weersport.nl`.  
Override only with explicit `WEERSPORT_ALLOW_PROD_CHECK=1` after Glenn review.

`scripts/check-phase7.mjs` orchestrates: health + capabilities, new Basis account (mailbox/log, no HTML token scrape reward), moment save/edit/delete, cross-account isolation, export smoke, and points at Gates A–C / Phase 6 checks.

## Evidence pack

Template: `docs/phase7-evidence/_template.md`  
Blank packs: `docs/phase7-evidence/gate-*.md`

Each pack records: commit, environment, date, fixture/provider ref, expected, actual, evidence path, **classification** (`static` | `automated` | `manual_uat` | `untested`), reviewer, unresolved defects, GO/NO-GO/PENDING.

A source-string assertion is **static**, not browser UAT.

## Rollback (known-safe build)

1. Pin/redeploy the last known-safe commit that **keeps Phase 0 recovery containment closed**.
2. Do **not** re-enable browser delivery of recovery/verification tokens.
3. Billing: webhooks stay idempotent on `mollie:payment:{id}:status:{status}` — do not manually replay paid transitions after rollback.
4. Prefer capability flags (auth / recommendations / checkout) over an emergency full rollback when only one subsystem misbehaves.
5. Keep safety/UV reachable while recommendations or checkout are disabled.
6. Staging SQLite restore only on disposable data — never against production.

## Monitoring owners (assign before live)

| Signal | Owner (fill) |
|---|---|
| Recovery / signup failures | |
| Warning freshness / stale / NO_SCORE rate | |
| Quota ledger mismatches | |
| Payment / webhook mismatches | |

## Out of scope

- Production deploy / DNS / indexing enablement
- Mollie live merchant purchase
- Claiming manual visual/AT UAT complete without human evidence
