# Phase 08 — Release gate & staging UAT

Figma: `H06 / Test Matrix & Release Gate` (`314:8`) · handoff fase 08.

## Doel

E2E, security, accessibility en staging UAT aantoonbaar maken. **Geen automatische productie-GO** — reviewbeslissing blijft menselijk.

## P0-matrix

| ID | Domein | Geautomatiseerd bewijs |
|---|---|---|
| QA0 | UI & responsive | Phase 01 + a11y/skip-link in `check-phase08` |
| QA1 | 24 sportprofielen | `check-phase04` |
| QA2 | Safety & UV | `check-phase03` / `04` NO_SCORE |
| QA3 | Authenticatie | `check-phase02` |
| QA4 | Verbruik & cache | `check-phase06` |
| QA5 | Mollie + refund | `check-phase06` + `/api/billing/refund` sandbox |
| QA6 | AdSense & cookies | `check-phase07` |
| QA7 | Persoonlijke data | `/api/account/export`, `/api/account/delete` |

## Security

- Headers via `next.config.ts`: CSP, `X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy
- `poweredByHeader: false`
- Session cookies: HttpOnly + SameSite=Lax (+ Secure op HTTPS)
- Login throttling

## Monitoring

- `GET /api/health` — database ping + latency

## Support

- `/support` · `/support/terugbetaling`
- Staging UI: `/release-gate`

## Rollback

Herstel vorige release-branch (`cursor/phase-07-adsense-cmp-35f3` of getagde productie). SQLite-bestand terugzetten indien privacy-delete onbedoeld op staging draaide.

## Sign-off checklist

- [ ] `npm run check` (01–08) groen
- [ ] Live `WEERSPORT_BASE_URL=… npm run check` groen
- [ ] Security headers aanwezig op homepage
- [ ] Export + delete smoke getest
- [ ] Sandbox refund → Pro uit
- [ ] Cookie CMP + ad-uitsluitingen
- [ ] Screenshots 390 / 1440 van release-gate + privacy
- [ ] Expliciete menselijke GO / NO-GO

**Bekende risico's:** live Mollie-refunds nog dashboard-pad; KNMI/RWS/zwemwater blijven `NOT_LINKED` tot keys; CSP kan strakker zonder `unsafe-eval` na Next-audit.
