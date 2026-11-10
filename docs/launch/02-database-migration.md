# WeerSport — Phase 03 inspection

Baseline main SHA: `82ee2622fdcb2a1d22cbc533ac45d0d923fc590e`

Working branch / PR: `cursor/phase-03-schema-inspection-eee9`

Scope: safe inspection only. Map the SQLite domains, compare them with the applied Supabase schema, and write the backup and cutover plan. No data copy, no drop, no cutover, no merge.

Implemented files:

- `docs/launch/02-database-migration.md`
- `docs/launch/schema-diff.md`
- `docs/launch/schema-before.json`

Changed DB migrations: none. The provider SQL already on main was not run again.

Tests PASS: read-only catalog queries and exact `count(*)` on the nine provider tables. Local SQLite was opened read-only for table names and counts.

Tests FAIL: none in this inspection. No application test suite was required for a docs-only pass.

E2E evidence screenshots / logs (sanitized): none. No user rows, hashes, tokens, or connection strings were printed.

External live API checks: none.

Provider/billing data freshness: provider tables are empty. Billing tables do not exist in Postgres. The app still scores from process memory and SQLite, not from these tables.

Feature flags Preview: unchanged. Data flags stay off. Sponsor flags stay off.

Feature flags Production: unchanged. Vercel production still has no data-flag variables.

Secrets checked present/missing (names only):

| Name | Where | State |
|---|---|---|
| `DATABASE_URL` | this inspection environment | present, not stored |
| `DATABASE_URL` | Vercel production, preview, development | missing |
| `WEERSPORT_DB` | Vercel production, preview, development | present |
| `KNMI_API_KEY` | Vercel | missing |
| `DATA_SYNC_SECRET` | Vercel | missing |

Known limitations: production SQLite is not an exportable file. Postgres has no account or payment tables. RLS is off on the empty provider tables.

Data migration reconciliation counts: provider tables 0. Local checkout SQLite `users`, `sessions`, `tokens`, and `login_attempts` are 0. Production row counts are unknown because the file cannot be read from here.

Rollback method: do nothing to the live app. It keeps using SQLite. Do not drop the provider tables. A later cutover, once approved, rolls back only before the app starts writing to Postgres, or after that only with a reconciliation.

Decision log updated: no

Gate decision: NEEDS_INPUT

Next phase: not started. Provider activation stays closed.

Human approvals required before continuing: a controlled production export, or a written confirmation that there are no durable accounts to move; a reviewed RLS and grant migration before any account table is created; an explicit cutover GO. This inspection does not grant those.

## Where the data lives

The running app opens one SQLite file from `lib/auth/db.ts`. The path is `WEERSPORT_DB`, otherwise `data/weersport.sqlite`. Billing, moments, and sponsoring tables are created on first use in that same file.

Vercel sets `WEERSPORT_DB` for production, preview, and development. The project comment on that variable says the path is ephemeral serverless storage and does not survive instances. There is no `DATABASE_URL` on Vercel. This environment cannot read the Vercel disk, and a redeploy cannot be treated as a backup.

The checkout contains `data/weersport.sqlite`. It is gitignored. Read-only inspection found only `users`, `sessions`, `tokens`, and `login_attempts`, with 0 rows in each. Billing and sponsor tables were never created in that file. Those zeros are the local checkout, not production.

Supabase project `fgznemnxnhdraoghfcwm` was read through the session pooler. The nine provider tables from the open-data migration are present and empty. Details are in `schema-before.json` and `schema-diff.md`.

## Domain map

Password hashes are `scrypt$<salt>$<hash>` from `lib/auth/password.ts`. Import must keep that string. Verification uses N=16384, r=8, p=1. Sessions, email tokens, and sponsor manage tokens store only a SHA-256 digest.

| Domain | SQLite source | Proposed Postgres home | This inspection |
|---|---|---|---|
| Accounts | `users` | `app_users`, original ids, unique normalized email, unchanged scrypt string | not created, not copied |
| Sessions | `sessions` | `app_sessions`, digest only | not created, not copied |
| Verification and reset | `tokens` | `auth_tokens`, expiry and used state | not created, not copied |
| Login throttle | `login_attempts` | `auth_login_attempts` | not created, not copied |
| Drafts | `users.draft_json` | column or `app_drafts` | not copied |
| Moments and preferences | `planned_moments`, `saved_searches`, `favorite_sports`, `user_preferences` | matching app tables, with owner ids | not created, not copied |
| Analysis use and cache | `analysis_ledger`, `analysis_cache` | same names, unique user plus idempotency key | not created, not copied |
| Pro payments | `billing_customers`, `billing_checkouts`, `billing_subscriptions`, `billing_invoices`, `billing_webhook_events` | same names, integer cents, unique provider ids | not created, not copied |
| Legacy sponsor requests | `sponsorship_requests`, `sponsor_campaigns`, `sponsor_events` | kept as historical tables, not merged into the new contract by guess | not created, not copied |
| Sponsor contracts | `sponsor_profiles`, `sponsor_billing_profiles`, `sponsor_quotes`, `sponsor_contracts`, `sponsor_contract_sports`, `sponsor_checkouts`, `sponsor_invoice_periods`, `sponsor_operations`, `sponsor_provider_objects`, `sponsor_audit`, `sponsor_manage_tokens` | same contract identity, one invoice per contract period | not created, not copied |
| Logos | `sponsor_logos.body_base64` | object storage plus metadata and checksum | not copied |
| Affiliate fixtures | `affiliate_*` | stay out of the account cutover | not copied |
| Provider ingest | not in SQLite; process memory in the app | the nine tables already present | empty, not read by the app |

`schema-diff.md` lists the unique keys that a future upsert must keep. Foreign keys are mostly absent in SQLite. They get added only after a count check shows every child row has a parent. Missing parents are reported, not invented.

## Backup plan

Not executed. Production rows were not found, so there was nothing safe to copy.

When the owner supplies a controlled SQLite file, or confirms a specific server disk that still has it:

1. Copy that file offline. Do not read it from a running Vercel instance and do not treat `/tmp` as the source.
2. Encrypt the copy. Record the SHA-256 of the plaintext file, the date, and the byte size in the launch notes. Do not store the encryption key in git.
3. Open the copy read-only. Record row counts per table and the sum of `billing_invoices.amount_cents` and `sponsor_invoice_periods.gross_cents`. Do not print password hashes, session digests, reset digests, emails, or invoice addresses into logs.
4. Restore the encrypted copy onto a separate machine and compare those counts. A backup that has not been restored is not a backup.
5. Keep the encrypted copy until the Postgres counts match and the owner signs the retention end. Do not delete the source file as part of the first write to Postgres.

If no production file can be produced, account migration stays blocked. An empty Postgres user table must not be filled with sample people.

## Consistency plan

Before any cutover command is allowed:

- Schema diff is reviewed again. New SQL is additive and versioned. No `DROP` of the provider tables.
- RLS is enabled on every exposed table that will hold accounts, sessions, payments, or sponsor data. `anon` and `authenticated` lose write and truncate rights on those tables. The current provider tables need the same review before they hold live snapshots, because they are already granted to `anon`.
- Dry run prints counts and a list of rejected rows. It does not write.
- Apply uses upsert on the natural keys in `schema-diff.md`. Re-running it does not duplicate invoices, checkouts, or analysis charges.
- After apply, these counts match the backup notes: users, verified users, active sessions, ledger rows per user per month, distinct Pro subscriptions, invoice cent totals, sponsor contracts by status, invoice periods, and logo object checksums.
- Restart the app and read the same account, payment state, and moment back. Two deploys must show the same rows.
- Provider tables stay at 0 until a later ingest. Their emptiness is expected and is not a failed account import.

## Cutover plan

Not executed. Gate for this cutover: NEEDS_INPUT.

The sequence, once the approvals exist:

1. Freeze new writes. The site can keep reading SQLite during the final export.
2. Take the encrypted backup and the count sheet.
3. Import the final delta with the dry-run report attached.
4. Compare counts and cent totals. Stop on any mismatch.
5. Set the server `DATABASE_URL` and point the app at Postgres. Leave the data flags off.
6. Smoke-test login with an existing password, one saved moment, and one billing status. Do not charge anyone.
7. Keep the SQLite file read-only. Do not switch back after new Postgres writes without a row-level reconciliation.

Rollback before step 5 is to leave the app on SQLite. Rollback after step 5 is a forward repair, or a return to SQLite only when Postgres has not accepted new writes that SQLite lacks. Provider tables are not dropped in either case.

## Blockers

| Blocker | State |
|---|---|
| Durable production SQLite export | missing; Vercel path is ephemeral and was not readable |
| Confirmation that production has no accounts to keep | not given |
| `DATABASE_URL` on Vercel | missing |
| RLS and grant review before account tables exist | not done; provider tables are already world-writable through the Data API |
| App code reading Postgres | not started; `lib/data/storage/memory.ts` is still the provider cache |
| Cutover approval | not given |
