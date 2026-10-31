# Quotas, schedules, domain verification (WS6)

## Atomic schedules
Due schedules are claimed with PostgreSQL `FOR UPDATE SKIP LOCKED` so only one instance processes each due row under concurrency.

Ticker runs when `RUN_MODE` is `worker` or `all` (not `api`).

## Default free plan quotas
| Limit | Default |
|-------|---------|
| Websites | 5 |
| Pages per scan | 50 |
| Scans per day | 20 |
| Min schedule interval | 24h |

Errors use HTTP 402 (plan limits) or 429 (daily scan limit).

## Domain verification
Required before:
- Creating a scan **schedule**
- Enabling `checkExposedPaths` on a scan

```http
POST /api/websites/:id/verify/start
POST /api/websites/:id/verify/confirm
```

DNS TXT: `qa-lab-verification=<token>`  
Or HTTPS `/.well-known/qa-lab-verification.txt` containing the token.
