# Evidence pack — gate-b

| Field | Value |
|---|---|
| Gate | Gate B — quota metering |
| Commit | _(fill at UAT)_ |
| Environment | disposable staging / local |
| Date | |
| Fixture / provider ref | concurrent POST `/api/moment`, idempotency keys |
| Expected | One booking under race; duplicates share charge; exhausted keeps UV/safety |
| Actual | |
| Evidence | `scripts/check-phase4.mjs` |
| Classification | automated |
| Reviewer | |
| Unresolved defects | |
| Decision | PENDING |
