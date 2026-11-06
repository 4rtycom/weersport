# Phase 5 — Paid Pro (Mollie lifecycle)

Depends on Phase 1 identity and Phase 4 metering. **No unpaid provider purchase and no deploy** in this PR. Glenn must approve terms, refund handling and merchant configuration before opening real payments.

## Modes

| Mode | When | Checkout |
|---|---|---|
| `disabled` | `WEERSPORT_BILLING_DISABLED=1`, invalid key shape, production without `live_`, production `test_` without allow flag | Refused (503) |
| `sandbox-local` | No `MOLLIE_API_KEY` (non-production) | Local simulate/refund |
| `test` | Key starts with `test_` | Mollie test API |
| `live` | Key starts with `live_` | Mollie live API |

Absent or incorrect live keys **disable** checkout (`lib/billing/mollie-mode.ts`).

## Durable webhook processing

Duplicate key = `mollie:payment:{paymentId}:status:{verifiedStatus}` (not a random delivery UUID).

Out-of-order guards:
- Late `paid` after `refunded` → ignored
- Late `failed` after `paid` → ignored

Activation, renewal and refund apply invoice + subscription changes in `BEGIN IMMEDIATE` transactions.

## Provider identities

Stored on subscription/customer rows: `mollie_customer_id`, `mollie_subscription_id`, `mollie_mandate_id`. Customer-visible `resetAt` / `currentPeriodEnd` come from `current_period_end` after verified pay/renew.

## Gate C (sandbox)

With `WEERSPORT_BASE_URL` + `WEERSPORT_MAIL_DRIVER=log` and no `MOLLIE_API_KEY` (`sandbox-local`):

`scripts/check-phase5.mjs` covers first payment → duplicate delivery → late failed (ignored) → renewal → failed collection (`past_due` keeps Pro) → cancel → refund → late paid after refund (ignored).

With `WEERSPORT_BILLING_DISABLED=1`, health reports `billingMode=disabled` / `checkoutEnabled=false` (disabled-checkout evidence).

## Out of scope

- Purchasing Mollie live merchant / opening real charges
- Deploy / DNS
- Phase 6 public UX / SEO (separate PR)
