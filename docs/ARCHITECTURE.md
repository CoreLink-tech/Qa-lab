# QA Lab Architecture

> Last updated: 2026-10-31  
> Status: Phase 1 stabilization in progress

## 1. Overview

QA Lab is a website Quality Assurance platform consisting of:

1. **CLI Scanner Engine** (root) – a modular, CommonJS Node.js tool that crawls sites, runs rule-based analysis, scores results, and produces reports.
2. **Backend API** (`qa-lab-backend/`) – NestJS + Prisma + PostgreSQL + Redis/BullMQ platform for multi-tenant workspaces, scan orchestration, authentication, and persistence.
3. **Future Dashboard** (`apps/web` planned) – web UI for projects, scans, trends, and reports.
4. **Infra** – Docker Compose for local development; cloud-ready deployment model.

The scanner remains usable as a standalone CLI while being made importable as a library so backend workers can invoke it safely.

## 2. Root CLI Scanner Architecture

### Entry point
- `src/index.js` – CLI binary (`qalab` / `node src/index.js <url> [flags]`).

### Core pipeline (current)
1. **Argument parsing** – URL + flags (`--concurrency`, `--depth`, `--max-pages`, `--delay`, `--fail-on`, `--min-score`, `--check-exposed-paths`, plugins, etc.).
2. **Site crawling** (`siteCrawler.js`) – discovers internal pages, respects depth/max-pages, optional robots.txt, concurrency control, rate limiting.
3. **Page fetching** (`pageFetcher.js` + `utils/httpClient.js`) – HTTP (axios) with Playwright available for JS-heavy needs.
4. **Normalization** (`normalizer.js`) – extracts structured page model (headings, meta, links, images, forms, headers, cookies, technology signals, etc.) while discarding raw HTML to control memory.
5. **Rule engine** (`ruleEngine.js` + `core/ruleRegistry.js` + `src/rules/*`) – modular rules by domain:
   - SEO, Accessibility, Security, Performance, Forms, Links, Assets, Functionality, Exposed Paths (opt-in).
   - Per-page rules + final/aggregate rules.
   - Plugin support via rule registry.
6. **Finding aggregation** (`findingAggregator.js`) – groups by rule id.
7. **Scoring** (`scoring.js`) – overall score, letter grade, category breakdown.
8. **Recommendations** (`recommendations/`).
9. **Reports** – JSON, HTML, Markdown, CSV, terminal, dashboard generator, PR comment, webhooks.
10. **Quality gate** (`qualityGate.js`) – exit code control for CI (`--fail-on`, `--min-score`).
11. **History / comparison** – local scan history for trend comparison.

### Design principles (preserved)
- CommonJS for the CLI surface.
- Rules are pure functions over normalized page / site models.
- Streaming-friendly pipeline for larger sites (recent improvements).
- Passive security checks only; opt-in exposed-path probing is still read-only.

### Target library API (Phase 2)
The scanner will expose a clean programmatic interface (TypeScript definitions + JS implementation) so workers can call:

```ts
scan(request: ScanRequest): Promise<ScanResult>
```

without going through process.argv or writing files unless requested.

## 3. Backend Architecture (`qa-lab-backend/`)

### Stack
- NestJS 11 (TypeScript)
- Prisma 7 + PostgreSQL
- Redis (ioredis) + BullMQ for queues
- Helmet, throttling, class-validator / class-transformer
- Swagger, Terminus health checks
- JWT-based auth (access + refresh) planned / partially scaffolded

### Current modules
- `config/` – validated environment configuration
- `database/` – PrismaService
- `redis/` – RedisService
- `health/` – DB + Redis health indicators

### Planned / in-progress domains
- Auth (register, login, refresh, email verification)
- Organizations / workspaces + memberships + roles
- Projects & Websites
- Scan orchestration (create → queue → worker → persist)
- Reports storage & retrieval
- API keys (org-scoped)
- Audit logging
- Scheduling / recurring scans
- Webhooks & notifications
- Quality-gate integration for CI

### Data model (Prisma – high level)
- **User** – identity, password hash, status
- **Organization** – multi-tenant workspace
- **OrganizationMember** – role (OWNER / ADMIN / MEMBER / VIEWER)
- **Project** – belongs to org
- **Website** – target URL under a project
- **Scan** – status (QUEUED → RUNNING → COMPLETED/FAILED/CANCELLED), trigger type
- **Report** – score, grade, issueCount, reportJson (Json), optional reportHtml
- **RefreshToken**, **ApiKey**, **AuditLog**

Large report payloads live in the `Report` table. Strategy: keep frequently queried summary fields (score, grade, counts) denormalized; store full JSON for download / detailed views; consider object storage later if payloads grow.

## 4. Data flow – Scan request → Report

```
User / API / CI
    ↓
POST /scans (or scheduled job)
    ↓
AuthZ (org membership + project access)
    ↓
Create Scan row (status=QUEUED)
    ↓
Enqueue BullMQ job (scan queue)
    ↓
Worker picks job
    ↓
SSRF-safe URL validation + policy checks
    ↓
Invoke scanner library (ScanRequest → ScanResult)
    ↓
Normalize / persist Report + update Scan status
    ↓
Optional: webhooks, PR comment, notifications
    ↓
Dashboard / API consumers read Scan + Report
```

Workers run the existing scanner engine in-process (or as a controlled child process) with resource limits, timeouts, and cancellation support.

## 5. Queue / Worker architecture

- **Redis** – broker + lock store
- **BullMQ** – scan queue(s), optional scheduled/repeatable jobs
- Job payload: `{ scanId, websiteId, options }`
- Worker:
  - Loads scan + website from DB
  - Applies org/project defaults + per-scan overrides
  - Calls scanner library with progress callbacks (optional Redis pub/sub or DB progress updates)
  - Writes Report, updates status, handles failures/retries
- Concurrency and rate limits configurable per deployment
- Dead-letter / failed job inspection via BullMQ dashboard or admin endpoints

## 6. Security boundaries

- **Never trust user-supplied URLs** – SSRF protection (block private/link-local/metadata IPs, enforce scheme, optional allow-list domains).
- **No user-supplied code execution**.
- **AuthN** – JWT access + refresh tokens; password hashing (bcrypt/argon2).
- **AuthZ** – every service method checks organization membership and role.
- **API keys** – hashed at rest, scoped, rotatable, never logged in full.
- **Input validation** – class-validator on all DTOs.
- **Security scanning** – passive only; `--check-exposed-paths` remains opt-in and authorization-gated.
- **Secrets** – never commit; use `.env` + secrets manager in production.
- **Headers / hardening** – Helmet, rate limiting, CORS restricted.
- **Audit log** – sensitive actions recorded.

## 7. Deployment model

### Local
- `docker-compose.yml` (Postgres + Redis) at backend or root.
- API: `npm run start:dev`
- CLI: `node src/index.js …` or `npx qalab …`
- Future web: `npm run dev` in apps/web

### Production (target)
- Docker images for API + worker(s)
- Managed Postgres + Redis
- Object storage for large HTML reports (optional evolution)
- Horizontal workers behind the same queue
- Observability: structured logs, health endpoints, metrics
- CI: GitHub Actions (lint, typecheck, unit, e2e, image build)

### Compose files
- `docker-compose.yml` – local development (DB + Redis)
- `docker-compose.prod.yml` (or cloud-specific) – full stack with API/worker

## 8. Repository layout (target after Phase 1)

```
/
├── src/                    # CLI scanner (kept at root for compatibility)
├── test/                   # CLI tests
├── qa-lab-backend/         # NestJS API (will become apps/api later if needed)
├── docs/                   # ARCHITECTURE.md, guides, ADRs
├── infra/                  # Docker, Terraform/Pulumi stubs, deploy scripts
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE/
├── package.json            # root scripts + workspaces (progressive)
├── docker-compose.yml
├── .env.example
├── CONTRIBUTING.md
└── CODEOWNERS
```

Progressive monorepo: keep CLI at root to avoid breaking existing users/docs; extract `packages/scanner` only when the library surface is stable and the churn is justified.

## 9. Command conventions (standardized)

| Scope   | Command                      | Purpose                          |
|---------|------------------------------|----------------------------------|
| Root    | `npm test`                   | CLI test suite                   |
| Root    | `npm run lint` (to add)      | Lint scanner                     |
| Backend | `npm run start:dev`          | API + watch                      |
| Backend | `npm test` / `npm run test:e2e` | Unit / e2e                     |
| Backend | `npx prisma migrate dev`     | Migrations                       |
| Backend | `npx prisma studio`          | DB UI                            |
| Infra   | `docker compose up -d`       | Postgres + Redis                 |

## 10. Next phases (summary)

- **Phase 1** (this document + scaffolding): stabilize repo, docs, CI, Docker, env examples, fix existing failures.
- **Phase 2**: scanner library API + worker-safe invocation + SSRF guards.
- **Phase 3+**: complete Auth, Projects, Scan API, workers, dashboard, scheduling, public API, monitoring, enterprise features.

---

This architecture prioritizes security, reuse of the proven CLI engine, clear separation of concerns, and incremental delivery toward a production multi-tenant QA platform.
