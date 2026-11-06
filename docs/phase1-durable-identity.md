# Phase 1 — Durable identity

Depends on Phase 0 containment. Glenn approves provider/cost/location before purchasing managed Postgres or a production mail sender.

## Inventory (SQLite callers)

| Domain | Tables | Entry points |
|---|---|---|
| Auth | `users`, `sessions`, `tokens`, `login_attempts` | `lib/auth/service.ts`, auth API routes |
| Moments | `planned_moments`, `saved_searches`, `favorite_sports`, `user_preferences` | `lib/moments/store.ts` |
| Billing | `analysis_*`, `billing_*` | `lib/billing/*` |
| Privacy | all of the above | `lib/account/privacy.ts` |
| Mail log | `outbound_mail` | `lib/mail/send.ts` (staging driver) |

Password hashes remain scrypt via `lib/auth/password.ts` (no rehash required).

## Decision

- **Durable store:** managed Postgres via `DATABASE_URL` (Neon / Vercel Postgres / equivalent). Pool size: `WEERSPORT_DB_POOL_MAX` (default 5).
- **Local default:** SQLite file (not durable across Vercel instances).
- **Mail:** Resend when `RESEND_API_KEY` + `WEERSPORT_MAIL_FROM` are set. Staging/local may use `WEERSPORT_MAIL_DRIVER=log` (DB-backed inbox, never on production).
- **Auth modes:** `closed` | `inbox` | `mailbox` (`lib/auth/release.ts`). Production opens signup/recovery only in `inbox` mode.

## Cutover

1. Glenn provisions Postgres + verified Resend sender; set env on staging.
2. `DATABASE_URL=... node scripts/migrate-sqlite-to-postgres.mjs` (source stays read-only).
3. Reconcile row counts per table; dual-run staging if needed.
4. Point app at Postgres; keep SQLite snapshot for rollback window.
5. Rollback: restore previous deployment + SQLite snapshot; do not replay billing webhooks.

Runtime note: this Phase 1 PR keeps the sync SQLite accessor for existing ledger/moments code. Full request-path Postgres runtime lands after the async cutover of those modules (tracked as follow-up). Schema + migration tooling are ready so Glenn can provision without waiting.

## Gate A evidence

With `WEERSPORT_MAIL_DRIVER=log` (non-production):

1. Register → mail appears via `GET /api/auth/mailbox?email=...&purpose=verify`
2. Open link once → verified; replay rejected
3. Reset flow via mailbox purpose=reset; sessions revoked
4. Draft restored after verify
5. Health reports `authDelivery: inbox`, `mailDriver: log`

With Resend: same flows against a disposable inbox.

## Env

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `WEERSPORT_DB` | SQLite path (local) |
| `RESEND_API_KEY` / `WEERSPORT_MAIL_FROM` | Production/staging inbox |
| `WEERSPORT_MAIL_DRIVER=log` | Staging capture inbox |
| `WEERSPORT_APP_ORIGIN` | Absolute links in mail |
| `WEERSPORT_ALLOW_DEV_AUTH=1` | Local browser mailbox only |
