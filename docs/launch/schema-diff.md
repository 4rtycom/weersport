# Schema diff — SQLite domains versus applied Supabase

Inspection date: 2026-11-10. No row contents were copied. No tables were dropped.

After approval, `20261110143000_app_sqlite_domains.sql` created the account, session, billing, and sponsor tables below. They are empty. The "absent" column describes the inspection before that file was applied.

## What Postgres already has

The nine provider tables from `supabase/migrations/20261110120000_provider_open_data.sql` match the file: same columns, primary keys, unique keys, and indexes. `pgcrypto` 1.3 and `postgis` 3.3.7 are installed. There is no `supabase_migrations` schema, so this apply was not recorded by the Supabase migration runner.

Every one of those nine tables has 0 rows. Row level security is off. There are no policies and no triggers. `anon` and `authenticated` have full table privileges, including `TRUNCATE`.

PostGIS also owns `spatial_ref_sys` and the geometry views. That is reference catalog data, not WeerSport data.

## What Postgres does not have

None of the application tables below exist in `public`. Accounts, password hashes, sessions, payments, and sponsor contracts are still defined only in the SQLite code path.

| Domain | SQLite table | Postgres |
|---|---|---|
| Account | `users` | absent |
| Session | `sessions` | absent |
| Verification and reset | `tokens` | absent |
| Login throttle | `login_attempts` | absent |
| Saved moment | `planned_moments` | absent |
| Saved search | `saved_searches` | absent |
| Favorite sport | `favorite_sports` | absent |
| Preference | `user_preferences` | absent |
| Search draft | `users.draft_json` | absent |
| Analysis use | `analysis_ledger` | absent |
| Analysis cache | `analysis_cache` | absent |
| Pro customer | `billing_customers` | absent |
| Pro checkout | `billing_checkouts` | absent |
| Pro subscription | `billing_subscriptions` | absent |
| Pro invoice | `billing_invoices` | absent |
| Pro webhook | `billing_webhook_events` | absent |
| Legacy sponsor request | `sponsorship_requests` | absent |
| Legacy campaign | `sponsor_campaigns` | absent |
| Legacy campaign event | `sponsor_events` | absent |
| Sponsor profile | `sponsor_profiles` | absent |
| Sponsor billing | `sponsor_billing_profiles` | absent |
| Sponsor logo bytes | `sponsor_logos` | absent |
| Sponsor quote | `sponsor_quotes` | absent |
| Sponsor contract | `sponsor_contracts` | absent |
| Contract sports | `sponsor_contract_sports` | absent |
| Sponsor checkout | `sponsor_checkouts` | absent |
| Sponsor invoice period | `sponsor_invoice_periods` | absent |
| Sponsor job | `sponsor_operations` | absent |
| Sponsor provider object | `sponsor_provider_objects` | absent |
| Sponsor audit | `sponsor_audit` | absent |
| Sponsor manage token | `sponsor_manage_tokens` | absent |
| Affiliate offer and stats | `affiliate_offers`, `affiliate_generations`, `affiliate_rules`, `affiliate_daily`, `affiliate_events`, `affiliate_conversions` | absent |

## Identity rules to keep when a later migration is approved

- `users.id` stays the original text id. Email is stored lowercase and unique. `password_hash` stays the existing `scrypt$<salt>$<hash>` string. Parameters are N=16384, r=8, p=1, a 16-byte salt and a 32-byte hash, both base64url. Do not rehash during import.
- `sessions.token_hash` and `tokens.token_hash` are SHA-256 base64url digests. The raw token is not stored.
- `sponsor_manage_tokens.token_hash` is the same kind of digest.
- Billing and sponsor money fields stay integer cents. Unique keys to preserve: `analysis_ledger (user_id, cache_key)` and `(user_id, idempotency_key)`, `billing_checkouts.idempotency_key`, `billing_webhook_events.provider_event_id`, `sponsor_checkouts.attempt_id`, `sponsor_checkouts.mollie_payment_id`, `sponsor_invoice_periods (contract_id, period_start)`, `sponsor_operations.op_key`, `sponsor_provider_objects.provider_id`.
- SQLite declares almost no foreign keys. A Postgres migration must add them only after the row counts prove every child id exists. Do not invent missing parents.
- `sponsor_logos.body_base64` is not the durable file store. A later step moves bytes to object storage and keeps the checksum. This inspection did not read any logo.

## Drift that blocks putting accounts in this database

The provider tables are reachable through the Data API as `anon` because RLS is off and the default grants are still in place. Account, session, billing, and sponsor tables must not be created in `public` with that grant set. The fix is a later, reviewed migration: enable RLS, remove `anon` and `authenticated` write grants, and keep server access on a role that the browser never receives. That migration was not run.
