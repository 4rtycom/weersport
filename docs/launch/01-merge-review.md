# WeerSport — Phase 01 Execution Report

Baseline main SHA: `96a5b7e87c15f4bae6769d147263d365788638b8`

Working branch / PR: `cursor/nl-open-data-integrations-eee9` / https://github.com/4rtycom/weersport/pull/35

Scope: safe Phase 01 only. Review and test PR 35. Flags stay off. No merge. No later phase.

Implemented files:

- `lib/data/knmi/parse.ts`
- `lib/data/knmi/ingest.ts`
- `lib/data/safety-gate.ts`
- `lib/data/providers/health.ts`
- `scripts/check-data-integrations.ts`
- `docs/launch/01-merge-review.md`

Implementation commit: `613ea5c5200270302724c1c6041574b7ddfdc468`

Previous PR head: `e8bbab4f7c70724cb1475e9ad50b7d74a1c42cf3`

Changed DB migrations: none in this phase. The existing file `supabase/migrations/20261110120000_provider_open_data.sql` was applied once before this review. The app still does not read those tables.

Tests PASS:

- `npm ci`
- `npm run check`
- `npm run check:guides`
- `npm run check:sponsor`
- `npm run check:data`
- `npx tsc --noEmit`
- `npm run build`
- Local preview smoke with all four `DATA_*` flags unset

Tests FAIL: none.

E2E evidence screenshots / logs (sanitized): no UI screenshots. Local `next start` on port 3456, flags unset:

| Request | Result |
|---|---|
| `GET /api/plaatsen?q=utrecht` | 200, Utrecht returned, no secret |
| `GET /api/plaatsen/suggest?q=utrecht` | 404 |
| `GET /api/plaatsen/reverse?lat=52.09&lon=5.12` | 404 |
| `POST /api/moment` | 401 |
| `GET /moment` | redirect to `/auth/inloggen` |
| `GET /admin/data-sources` | 200, text says the page is shielded; no flag values and no key |
| `POST /api/internal/data/sync` | 503, secret name missing, value not present |
| `GET /sporten/fietsen` | 200 |
| `GET /sporten/hardlopen` | 200 |
| `GET /sponsoring` | 200 |
| `GET /auth/inloggen` | 200 |
| `GET /checkout/pro` | redirect to `/auth/inloggen` |
| `GET /api/health` | 200 |

External live API checks: PDOK woonplaats search for Utrecht returned a place. KNMI, RWS and Luchtmeetnet were not called. Label: local preview, flags off.

Provider/billing data freshness: not applicable. Provider flags off, so those feeds stay `NOT_LINKED`. Billing was not exercised against Mollie.

Feature flags Preview: Vercel project `weersport` has no `DATA_KNMI_ENABLED`, `DATA_RWS_ENABLED`, `DATA_PDOK_V2_ENABLED`, or `DATA_LUCHTMEETNET_ENABLED`. Absent is off, because the code accepts only the exact string `true`. Sponsor flags are also absent, so they stay off (`1` is required). The ready preview deployment for `e8bbab4` is `dpl_9LDcTYpQU8XJSEEbtrkMSMviRfQy` and its target is preview, not production. That deployment is behind Vercel SSO, so the route smoke above is local.

Feature flags Production: the latest production deployment is from `main` at `96a5b7e87c15f4bae6769d147263d365788638b8` (`dpl_8JEzeua77XgffVHzPkGmKLKt4TzW`). The same Vercel env list has no data or sponsor flags. This phase did not change production env.

Secrets checked present/missing (names only):

| Name | Vercel production, preview, and development |
|---|---|
| `WEERSPORT_DB` | present |
| `DATABASE_URL` | missing |
| `KNMI_API_KEY` | missing |
| `DATA_SYNC_SECRET` | missing |
| `DATA_KNMI_ENABLED` | missing |
| `DATA_RWS_ENABLED` | missing |
| `DATA_PDOK_V2_ENABLED` | missing |
| `DATA_LUCHTMEETNET_ENABLED` | missing |
| `WEERSPORT_SPONSOR_SIGNUP` | missing |
| `WEERSPORT_SPONSOR_PUBLISH` | missing |
| `WEERSPORT_SPONSOR_COLLECT` | missing |
| `WEERSPORT_AFFILIATE_DISPLAY` | missing |

Known limitations:

- Runtime provider storage is process memory. `dataSourceStatus()` still reports `durableStore: not-applied`. The nine provider tables exist in the Supabase project, but this app does not read or write them. That is Phase 03 work.
- A fresh empty operational KNMI snapshot now says `geen KNMI-waarschuwing in gecontroleerd venster` and includes the KNMI source and publication time. A stale snapshot, a test publication, an exercise-only snapshot, and a missing feed stay `UNKNOWN` and do not say there is no warning.
- Sponsor blocks stay hidden for an official warning or any warning item. They are not hidden merely because KNMI is `NOT_LINKED`. Changing that now would hide the existing sponsor preview on every scored moment while the data flags are off. Phase 05/06 owns that policy choice.
- GitHub has no approving review. Bugbot commented on `a7383c7` and the four fixes are already in `e8bbab4`. The side branch `cursor/multiple-bug-corrections-e256` was not merged.
- Remote CI for `613ea5c` was not recorded yet when this document was written. The local suite above passed. The previous head had a green Vercel preview and a green Bugbot check.
- Unauthenticated `/checkout/pro` and `/moment` redirect to login. That is the existing session gate, not a server error.

Data migration reconciliation counts: nine public tables confirmed before this phase: `air_measurements`, `air_stations`, `knmi_warning_parts`, `knmi_warnings`, `place_geo_cache`, `provider_snapshots`, `provider_sync_runs`, `rws_measurement_locations`, `rws_measurements`. No row counts. No personal data. This phase did not run SQL.

Rollback method: leave all four data flags off. If the code is wrong after a future merge, revert that merge in a separate PR. Do not drop the provider tables from this step.

Decision log updated: no

Gate decision: NEEDS_INPUT

Next phase: not started.

Human approvals required before continuing:

- Explicit approval to merge PR 35 into `main`. This phase was told not to merge.
- An approving review is not on the PR. Bugbot's comment is not that approval.
- Phase 02 stays closed until that merge decision is made.

## WS-101 to WS-113

| Ticket | Result |
|---|---|
| WS-101 | `origin/main` is `96a5b7e`. PR head before the fix was `e8bbab4`, two commits ahead, zero behind, mergeable, `mergeStateStatus: CLEAN`. 48 files. Production deployments are from `main`. |
| WS-102 | Reviewed the data engine, scoring clock, billing cache key, sync route, admin page, moment view, env example, README, and both SQL files. |
| WS-103 | Flags default off in code, `.env.example`, tests, local preview, and Vercel env. Admin without the sync header shows no key and no cache. Sync without a secret returns 503 and does not call providers. |
| WS-104 | Summer, winter, 29 March 2026, and 25 October 2026 wall times are tested. The score window keeps 48 hours. Missing UV stays `null`. |
| WS-105 | Dataset id is `KNMI-public-weather-warnings/1.0`. Only `operational_status=Actual` is kept. Test and exercise snapshots are not a clear window. A fresh empty snapshot is allowed and names the source and time. |
| WS-106 | No spot, another water body, and a missing current quantity stay uncovered. Quality code `99` becomes `null`. |
| WS-107 | Station choice is per substance. Air older than three hours is not fresh. The air note says the hour is not extended across 48 hours. |
| WS-108 | Open-water swimming and natural ice stay `NO_SCORE`. Stale, test, exercise, and unlinked KNMI states are `UNKNOWN`. |
| WS-109 | Process memory is documented as not durable. Sponsor, guide, and phase checks still pass. |
| WS-110 | Local suite listed above passed. |
| WS-111 | Local preview smoke above. No secret in the sampled bodies. No manufactured warning. |
| WS-112 | Not done. Merge needs a human approval that this task withheld. |
| WS-113 | Not done. There is no post-merge `main` to verify. |
