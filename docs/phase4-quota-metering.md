# Phase 4 — Correct usage and quota-independent safety

Depends on Phase 1 (identity) and Phase 3 (scoring). Gate B evidence lives in `scripts/check-phase4.mjs`.

## Contracts

| Rule | Behaviour |
|---|---|
| Explicit start | Only `POST /api/moment` (or `/moment?start=1` scripted) may book quota |
| Read-only revisit | `GET /api/moment` and default `GET /moment` peek cache only |
| Fingerprint | `userId:sport:place:period:AmsterdamHour` |
| Idempotency | Header/body key bound to user; duplicates share one charge |
| Atomic publish | SCORED cache written inside the same SQLite transaction as the ledger insert |
| Denied race | Rollback leaves no SCORED cache for the loser |
| Quota period | Calendar month in `Europe/Amsterdam`; reset 1st 00:00 local (`lib/billing/quota-policy.ts`) |
| Limits | Basis 5 / Pro 100 successful SCORED analyses |
| Non-consuming | NO_SCORE, provider failure (503), cache hits, saves |
| Exhausted safety | UV + warnings still load; suitability downgraded to NO_SCORE with quota reason |

## Gate B

- Two concurrent distinct requests with one credit → one booked
- Duplicate idempotency key → one charge
- Retry after denial does not reveal a SCORED cache from the failed attempt
- 5/100 boundaries, month key rollover, NO_SCORE, forced provider fail, cache hits, repeated GETs

## Out of scope

- Phase 5 Mollie lifecycle
- Phase 6 UX polish of exhausted states
- Deploy / provider purchase
