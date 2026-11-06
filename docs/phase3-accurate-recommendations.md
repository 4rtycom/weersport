# Phase 3 — Accurate recommendations

Depends on Phase 2 source contracts. Sport weightings remain **provisional** until Glenn commissions an independent review of weights and safety thresholds before treating scores as live recommendations.

## Changes

| Area | Behaviour |
|---|---|
| Open-Meteo | Request `timezone=UTC`, `forecast_days=3`; normalize valid times with `toUtcIso`; keep ≥48 future elapsed hours; no expired-hour fallback |
| Timeline | Distinguish `receivedAt`, `modelPublishedAt` (null until provider exposes a run time), `forecastValidFrom` / `forecastValidUntil` |
| UV | Missing values stay `null` / “niet beschikbaar” — never coerced to 0 |
| Scoring | Future hours only; complete contiguous **2-hour** windows; aggregation = mean of hour scores; tie-break = earlier start, then higher in-window peak |
| Distinctions | **Nu** (first future hour), **piek-uur** (max hour score), **aanbevolen venster** (best 2h window) |
| Model | `weersport-score-v0.2-phase3` on every scored view |

## Invariants

`node scripts/phase3-invariants.mjs` covers:

- best window at hour 36
- late-evening search
- DST spring/fall formatting
- gaps, isolated peak vs solid pair, equal-window tie-break
- all-past → NO_SCORE
- unknown UV
- one representative sport per family + all 24 catalog sports

## Out of scope

- Independent weighting/safety review (Glenn)
- Provider purchase / deploy
- Phase 4 metering Gate B
