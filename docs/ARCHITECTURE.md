# QA Lab Architecture

> Last updated: 2026-10-31  
> This document describes **what exists in the repository today**, not aspirational roadmap language.

## 1. Overview

QA Lab is a multi-tenant website quality-assurance system:

| Layer | Path | Role |
|-------|------|------|
| CLI + scanner library | `src/` | Crawl and score sites; CommonJS |
| API | `qa-lab-backend/` (`RUN_MODE=api`) | HTTP API, enqueue jobs |
| Worker | `qa-lab-backend/` (`RUN_MODE=worker`) | BullMQ consumer, runs scans |
| Dashboard | `apps/web/` | Next.js UI (port 3001) |
| Data | PostgreSQL + Redis | Prisma models + queues / rate limits |

Default local mode `RUN_MODE=all` runs the scan consumer inside the API process for convenience only. Production should use **separate** API and worker processes.

## 2. Scanner (`src/`)

### Pipeline
1. CLI (`src/index.js`) or library (`src/lib/scan.js`)
2. SSRF validation (`src/utils/ssrfGuard.js`) + safe HTTP (`src/utils/safeHttp.js`)
3. Crawl / fetch via shared `httpClient` (routed through safe layer)
4. Normalize pages → rule engine → findings → score → reports

### Security properties (scanner)
- Passive checks only (no exploit payloads).
- SSRF: DNS resolution, blocked private/special ranges (`ipaddr.js`), IP pinning, manual redirects, port allow-list.
- Credentials in URLs rejected.

### Library API
`src/lib/scan.js` exports `scan(request)` used by the worker. CLI remains supported.

## 3. Backend (`qa-lab-backend/`)

### Stack
NestJS 11, Prisma 7, PostgreSQL, Redis, BullMQ, JWT + opaque refresh tokens, Swagger, Terminus.

### Modules present
- **auth** — register/login/refresh/logout, email verify, password reset/change, lockout, refresh families, httpOnly refresh cookie
- **organizations / projects / websites** — membership AuthZ
- **scans** — queue jobs; JWT or API key (`scans:read` / `scans:write`)
- **schedules** — interval schedules; claim with `FOR UPDATE SKIP LOCKED`
- **api-keys** — create once / list / revoke; org-scoped principal
- **domain-verify** — DNS TXT or well-known file
- **quotas** — websites, pages/scan, scans/day, min schedule interval
- **audit** — best-effort audit rows
- **queue / worker** — BullMQ; worker isolation via `RUN_MODE`
- **observability** — request IDs, JSON logs, `/api/metrics`, live/ready
- **retention** — deletes old reports/audit/tokens on worker

### Auth model
- Access JWT (~15m) in response body; dashboard keeps it **in memory**.
- Refresh token: httpOnly cookie + body for non-browser clients; rotation + **family revoke on reuse**.
- API keys: `Authorization: Bearer qalab_…` or `X-API-Key`.

## 4. Dashboard (`apps/web/`)

Next.js App Router, Tailwind. Talks to API with `credentials: "include"`.  
CSP and security headers in `next.config.ts`.  
Not a full design system; functional UI for auth, projects, scans, settings (API keys).

## 5. Data model (high level)

User → OrganizationMember → Organization → Project → Website → Scan → Report  
Also: RefreshToken, ApiKey, ScanSchedule, AuditLog, PasswordResetToken.

Quotas live on Organization. Domain verification fields on Website.

## 6. Deployment

- Dev: `docker compose up -d` (Postgres + Redis only).
- Prod-oriented: `docker-compose.prod.yml` with **api** and **worker** targets from `qa-lab-backend/Dockerfile`.
- Migrations: **one-shot** `prisma migrate deploy`, not on every container start.

## 7. Threat model (summary)

| Threat | Mitigation | Residual risk |
|--------|------------|---------------|
| SSRF to internal network | Guard + pinned IP + redirect re-validation | DNS rebinding races reduced not eliminated; Playwright paths must stay gated |
| Cross-tenant IDOR | Membership checks; API keys org-scoped | Not every route has full HTTP e2e IDOR coverage |
| Credential theft (XSS) | Refresh httpOnly; access in memory | Access JWT still usable until expiry if XSS runs |
| Queue abuse | Quotas, org concurrency, throttling | Open registration still allows account spam |
| Worker overload | Timeouts, reaper, attempts/backoff | Scanner AbortSignal not fully wired end-to-end |
| Secret leakage in logs | Redaction helper | Misconfiguration can still log bodies |

## 8. Known limitations

1. Email defaults to **log-only**. Real delivery requires `EMAIL_MODE=smtp` and `SMTP_*` (nodemailer adapter).
2. TOTP 2FA is **not** implemented.
3. CSRF double-submit for pure cookie SPA mutations is **not** fully implemented (Bearer access + SameSite refresh).
4. Coverage gates are **baseline** (≥30% lines in CI), not 80%. Health + auth e2e run in CI.
5. API e2e (health, auth) run in CI; no Playwright UI e2e yet.
6. Worker timeout aborts via `AbortSignal` (crawler + safeHttp/axios). Residual: a request already in flight may finish before cancel takes effect.
7. CSP allows `'unsafe-inline'` / `'unsafe-eval'` for Next.js compatibility.
8. Plan tiers are enforced in code defaults; **no billing** integration.
9. Metrics are **per process**; scrape each replica.
10. Docs under `docs/` (AUTH, WORKER, API_KEYS, etc.) are authoritative for those subsystems.

## 9. Related docs

- `docs/AUTH.md`
- `docs/API_KEYS.md`
- `docs/WORKER.md`
- `docs/QUOTAS_AND_SCHEDULES.md`
- `docs/TESTING.md`
- `docs/OPERATIONS.md`
- `docs/CI_AND_BRANCH_PROTECTION.md`
