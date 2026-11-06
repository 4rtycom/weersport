# Phase 0 — Auth containment

Audited baseline: `d081f31c5985f16120190b9681ce3f826ab9fb29`.

## Problem

Password recovery and email verification delivered usable tokens through the `ws_dev_mail` cookie and HTML “ontwikkelmailbox” links. On a public Vercel production alias that is an account-takeover path.

## Containment

| Target | Behavior |
|---|---|
| `VERCEL_ENV=production` | Always **closed** |
| Vercel preview | Closed unless `WEERSPORT_ALLOW_DEV_AUTH=1` |
| Local | Dev mailbox allowed (set `WEERSPORT_FORCE_AUTH_CLOSED=1` to test closed) |

Closed mode:

- `POST /api/auth/registreren` → **503**, clears `ws_dev_mail`
- `POST /api/auth/herstel` → same `{ next }` for known/unknown; **no** token cookie; no reset token created
- `POST /api/auth/verifieer` / email change / prototype → **503**
- Verify/reset pages never render token links
- Billing simulate + sandbox refund → **403** on production
- Outstanding `verify`/`reset` tokens marked used once (`schema_migrations` id `phase0_invalidate_dev_tokens_v1`)

## Rollback (reviewed ops only)

1. Redeploy the previous known-safe build **only if** it keeps recovery closed, or keep this containment commit.
2. Do **not** re-enable browser token delivery on production.
3. To clear the migration marker (does not restore old tokens): call `clearTokenInvalidationMarker()` in a reviewed one-off, or `DELETE FROM schema_migrations WHERE id = 'phase0_invalidate_dev_tokens_v1'`.
4. Phase 1 must add real inbox delivery before reopening signup/recovery on public targets.

## Glenn actions (not done by Cursor)

- Confirm production project env: no `WEERSPORT_ALLOW_DEV_AUTH` on production.
- Rotate any accounts that may have been created while tokens were browser-visible.
- Review access logs for misuse of `/auth/herstel` and `/auth/verifieer/bevestig`.
- Do not set `WEERSPORT_ALLOW_PROD_CHECK=1` for automated suites against `weersport.vercel.app`.
