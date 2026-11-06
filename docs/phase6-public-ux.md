# Phase 6 — Public UX, SEO and performance

Depends on Phases 0–5 for result/checkout states. **No deploy, DNS change or Mollie purchase** in this PR. Glenn still owns canonical domain, support/partnership addresses and public indexing.

## Surfaces

| Area | Change |
|---|---|
| Consent | Compact reserved space; focus return; withdrawal via `/account/privacy` (`POST /api/consent` `{ reset: true }`) |
| Planner | Label on sport control; fixed “Komende 48 uur”; CTA “Zoek mijn sportmoment”; inline retry on network error; hero CTA “Plan mijn sportmoment” |
| Catalogue | All 24 tiles link to `/?sport={id}#planner` (zero credits); public footer links |
| Auth | Hervat leads with “zoekopdracht is bewaard”; unfinished Google stub removed |
| Quota / safety | Exhausted start-gate keeps UV/safety path + Basis→Pro CTA |
| Checkout | Disabled mode explained; pending verifies via Mollie API modes; refund link |
| Partnership | `/samenwerken` + mailto (`WEERSPORT_PARTNERSHIP_EMAIL`) |
| Support | Customer routes only — no staging release-gate / `/api/health` |
| SEO | `metadataBase`, robots, sitemap of indexable public routes; default **noindex** until `WEERSPORT_ALLOW_INDEXING=1` on `weersport.nl` |
| Perf | Hero `sizes`/`fetchPriority`; SVG preloads; lab notes in `docs/phase6-lab-metrics.md` |
| Fixtures | `/ux-states` index (404 on Vercel production) |

## Exit evidence

`scripts/check-phase6.mjs` asserts wiring + ads policy invariants. Manual UAT still required for 320–1440 widths, zoom, AT and visual compare against Figma.

## Env

| Variable | Effect |
|---|---|
| `WEERSPORT_PUBLIC_ORIGIN` | Canonical origin |
| `WEERSPORT_ALLOW_INDEXING=1` | Allow robots/sitemap only on approved host |
| `WEERSPORT_SUPPORT_EMAIL` | Support mailto |
| `WEERSPORT_PARTNERSHIP_EMAIL` | Partnership mailto |

## Out of scope

- Phase 7 staging UAT / controlled rollout
- Purchasing Mollie / opening live charges
- Deploy / DNS / production indexing without Glenn
