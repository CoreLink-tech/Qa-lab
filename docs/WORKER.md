# Scan worker (WS5)

## Process split
| Process | `RUN_MODE` | Entrypoint | Runs scans? |
|---------|------------|------------|-------------|
| API | `api` | `dist/main.js` | **No** |
| Worker | `worker` | `dist/main.worker.js` | **Yes** |
| Local all-in-one | `all` (default) | `dist/main.js` | Yes (dev only) |

```bash
# Dev API without worker
RUN_MODE=api npm run start:dev

# Dev worker
npm run start:worker:dev
```

## Limits
- Wall-clock timeout: `SCAN_TIMEOUT_MS` (default 10m)
- Hard max pages: `SCAN_HARD_MAX_PAGES` (default 200)
- Per-org concurrency: `ORG_SCAN_CONCURRENCY` (default 2)
- Worker concurrency: `WORKER_CONCURRENCY` (default 1)
- Stuck RUNNING reaper: `SCAN_STUCK_MS` (default 20m)

## BullMQ
- Attempts: 3, exponential backoff from 10s
- Stalled job detection enabled
- Idempotent skip if scan already COMPLETED/CANCELLED

## Ops notes
- Run migrations as a one-shot, not inside every worker/api replica.
- Prefer egress controls so workers cannot reach cloud metadata / private ranges (SSRF guard is application-level defense-in-depth).
