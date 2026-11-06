# Evidence pack — gate-c

| Field | Value |
|---|---|
| Gate | Gate C — Mollie lifecycle |
| Commit | _(fill at UAT)_ |
| Environment | sandbox-local (no purchase) |
| Date | |
| Fixture / provider ref | `/api/billing/simulate` transitions |
| Expected | pay→dup→renew→past_due→cancel→refund; late events ignored; disabled checkout |
| Actual | |
| Evidence | `scripts/check-phase5.mjs` |
| Classification | automated (live Mollie test still PENDING until Glenn keys) |
| Reviewer | |
| Unresolved defects | Live merchant / test key approval |
| Decision | PENDING |
