# Phase 2 — Source and safety contracts

Depends on Phase 0 containment. Live KNMI / RWS / zwemwater access waits on Glenn’s provider and rights approval — this phase ships contracts, fixtures and fail-closed behaviour without inventing safety claims.

## Contracts

| Concern | Location |
|---|---|
| Freshness thresholds | `lib/data/contracts.ts` |
| Attribution / commercial status | `lib/data/sources.ts` |
| 24-sport dependency matrix | `lib/data/sport-dependencies.ts` |
| Town-centroid coverage rule | `townCentroidCoverage()` + scoring |
| KNMI / water / swim adapters | `lib/data/adapters/*` |
| Provider freshness (DB-independent) | `GET /api/sources/status` |
| Deterministic fixtures | `fixtures/phase2/*` |

## Warning lifecycles

Adapters distinguish:

- `provider-failure` — fetch failed / missing critical
- `verified-all-clear` — successful fetch, no active items
- `active-warning` — official warning in scope (fixture or future live feed)
- `stale` — last success older than threshold (3h warnings)
- `partial-coverage` — incomplete spatial coverage
- `not-linked` — no approved live feed (default production)

## Coverage rule

PDOK place resolution yields a **town centroid**. That cannot establish lake, beach or ice conditions. Water and ice sports therefore return **NO_SCORE** with an explicit coverage reason, even if a water fixture returns `READY` values.

## Fixtures (non-production)

```bash
WEERSPORT_SOURCE_FIXTURES=1
WEERSPORT_KNMI_FIXTURE=active|all-clear|stale|failed|partial
WEERSPORT_WATER_FIXTURE=ready-town
WEERSPORT_SWIM_FIXTURE=ready
```

Never enabled when `VERCEL_ENV=production`.

## Exit evidence

1. Sport dependency matrix has 24 rows via `/api/sources/status`.
2. Land sport can score (weather) while safety/UV stay visible.
3. Water / swim / ice → NO_SCORE with coverage or missing-source reasons.
4. KNMI fixture scenarios: active, all-clear, stale, failed, partial.
5. Quota-exhausted users still see UV + warning panels (ads policy already blocks ads on NO_SCORE).
6. Unsupported claims stay deferred (`NOT_LINKED` without fixtures).

## Out of scope

- Purchasing KNMI / RWS / zwemwater products
- Deploy / DNS / production env mutation
- Phase 3 rolling-forecast scoring refinements
