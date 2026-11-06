# Phase 6 — Homepage lab metrics

Label: **lab only** (not field CrUX). Measure on a cold mobile profile under the same conditions before/after this PR.

## Method

1. Production build (`npm run build && npm start`) on loopback.
2. Chrome DevTools → Performance / Lighthouse, mobile, clear cache, disable cache.
3. Record LCP element (expect hero photo or H1), CLS, transfer size for `/`, `/home/hero.png`, `/home/halo.svg`, `/home/lime-dot.svg`.

## Asset notes (this branch)

| Asset | Notes |
|---|---|
| `/home/hero.png` | File is JPEG data (~222 KB, 1024×1024). Served with `sizes` + `fetchPriority="high"` on the hero `<img>`. |
| `/home/halo.svg`, `/home/lime-dot.svg` | Preloaded from root layout. |
| `/home/curve.svg` | Below-fold; no preload. |

## Template (fill during UAT)

| Metric | Before | After | Conditions |
|---|---|---|---|
| LCP (s) | | | cold mobile lab |
| CLS | | | cold mobile lab |
| `/` transfer (KB) | | | disable cache |
| Hero transfer (KB) | | | |

Do not present these numbers as field data.
