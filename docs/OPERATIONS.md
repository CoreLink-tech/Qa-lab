# Operations

## Health
| Endpoint | Purpose |
|----------|---------|
| `GET /api/health/live` | Liveness (process up) |
| `GET /api/health/ready` | Readiness (Postgres + Redis) |
| `GET /api/health` | Full checks including memory |
| `GET /api/metrics` | Prometheus text metrics |

## Migrations
Run as a **one-shot**, not on every replica start:

```bash
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
```

## Secrets rotation
1. Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` → all sessions invalid (users re-login).
2. Rotate `REDIS_PASSWORD` → bounce API + worker together.
3. Rotate DB password → update `DATABASE_URL`, bounce.
4. Revoke API keys in UI/Settings rather than rotating a global secret.

## Backups
- **Postgres**: daily `pg_dump` (or provider snapshots). Test restore quarterly.
- **Redis**: AOF enabled in prod compose; treat as ephemeral for queues — scans can be re-queued.
- **Object storage**: not used yet; reports live in Postgres JSON (size-capped).

## Scaling
- Scale **API** horizontally behind a load balancer (`TRUST_PROXY=true`).
- Scale **workers** independently (`RUN_MODE=worker`). Schedule claims use `SKIP LOCKED`.
- Per-org concurrency and daily quotas limit noisy tenants.

## Incident runbook (short)
1. Check `/api/health/ready` and `/api/metrics`.
2. Worker stuck: inspect BullMQ queue depth; restart worker; reaper fails stuck RUNNING scans.
3. SSRF / abuse: revoke API keys, lower `maxScansPerDay` on org, block IP at edge.
4. Data incident: rotate JWT secrets, force logout-all if available, audit `AuditLog`.

## Retention env
- `RETENTION_REPORT_DAYS` (default 90)
- `RETENTION_AUDIT_DAYS` (default 180)
- `REPORT_JSON_MAX_BYTES` (default 2_000_000)

## Error tracking
Optional: install `@sentry/node` and set `SENTRY_DSN`. Without it, errors stay in structured JSON logs.
