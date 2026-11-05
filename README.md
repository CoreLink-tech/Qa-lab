# QA Lab

[![CI](https://github.com/CoreLink-tech/Qa-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/CoreLink-tech/Qa-lab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](./docker-compose.yml)

**QA Lab** is a modular website quality-assurance and security-scanning platform. It crawls sites, evaluates performance, SEO, accessibility, forms, links, and security headers, and produces scored HTML/JSON reports. A NestJS API, BullMQ worker, and Next.js dashboard support multi-tenant operation.


### Verify from a fresh clone

```bash
git clone https://github.com/CoreLink-tech/Qa-lab.git
cd Qa-lab
npm ci                          # scanner + lockfile
npm run lint                    # scanner ESLint
npm test                        # scanner unit tests (explicit)

cd qa-lab-backend && npm ci && npm run lint && npm test && npm run build
cd ../apps/web && npm ci --legacy-peer-deps && npm test && npm run build
```

CI runs these same install / lint / test / build steps on every push to `main`.

## Problem

Teams need repeatable website QA beyond one-off Lighthouse runs: link integrity, form and header checks, accessibility signals, and a path to scheduled multi-tenant scanning with clear tenancy boundaries. QA Lab combines a focused scanner library with an API and worker suitable for productization.

## Key features

- **CLI scanner** — crawl with depth/page limits; checks for SEO, accessibility, links, forms, assets, exposed paths, security headers
- **Scored reports** — HTML and JSON with severity classification
- **Multi-tenant API** — organizations, projects, websites, scans, schedules, API keys
- **Auth** — register/login, rotating refresh cookies, optional TOTP, scoped API keys
- **SSRF controls** — DNS resolution policy, private IP blocking, pinned outbound HTTP
- **Worker** — queue-based scans, wall-clock timeout, optional process isolation
- **Dashboard** — Next.js UI (see `apps/web/`)

## Architecture overview

```
Browser / CLI  →  Next.js (apps/web)  →  NestJS API (qa-lab-backend)
                                              ↓
                                         Postgres + Redis
                                              ↓
                                         BullMQ Worker → Scanner library (src/)
```

| Component | Path | Role |
|-----------|------|------|
| Scanner | `src/` | Crawl + checks + reports |
| API | `qa-lab-backend/` (`RUN_MODE=api`) | HTTP API, auth, tenancy |
| Worker | `qa-lab-backend/` (`RUN_MODE=worker`) | Job consumer |
| Web | `apps/web/` | Dashboard |
| Infra | `docker-compose.yml` | Postgres, Redis |

See `docs/ARCHITECTURE.md` for detail.

## Technology stack

- **Runtime:** Node.js 20+ / 22
- **Scanner:** CommonJS libraries under `src/`
- **API:** NestJS 11, Prisma 7, PostgreSQL, Redis, BullMQ
- **Web:** Next.js 15, React, Tailwind
- **CI:** GitHub Actions, CodeQL, Trivy (filesystem)

## Prerequisites

- Node.js 20 or 22
- Docker and Docker Compose (for Postgres/Redis)
- npm 10+

## Local setup

```bash
git clone https://github.com/CoreLink-tech/Qa-lab.git
cd Qa-lab
cp .env.example .env

docker compose up -d

# Scanner / root
npm ci

# Backend
cd qa-lab-backend
cp .env.example .env   # set JWT_* secrets ≥ 32 characters
npm ci
npx prisma migrate deploy
npx prisma generate
npm run start:dev      # API + in-process worker when RUN_MODE=all

# Dashboard (other terminal)
cd apps/web
cp .env.example .env.local
npm ci
npm run dev
```

- UI: http://localhost:3001  
- API docs: http://localhost:3000/api/docs  
- Health: http://localhost:3000/api/health/live  

## Environment variables

Root `.env.example` and `qa-lab-backend/.env.example` document variables. Critical:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis for queues |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 character secrets |
| `CORS_ORIGIN` | Allowed browser origin |
| `QA_LAB_SCANNER_ROOT` | Path to scanner lib in containers |
| `SCAN_ISOLATION=child` | Optional per-scan child process |
| `EMAIL_MODE` / `SMTP_*` | Email delivery (default log-only) |

Never commit real `.env` files.

## Docker

**Development (Postgres + Redis):**

```bash
docker compose up -d
```

**Production-oriented (API + worker images):**

```bash
docker compose -f docker-compose.prod.yml up -d --build
# Migrations:
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
```

Build targets: `docker build -f qa-lab-backend/Dockerfile --target api|worker -t qa-lab-api|qa-lab-worker .`

## Development commands

```bash
# Scanner
npm test                 # root scanner tests
npm start -- --help      # CLI help (see src/index.js)

# Backend
cd qa-lab-backend
npm run lint
npm run typecheck
npm run build
npm test
npm run test:cov
npm run start:dev
npm run start:worker:dev

# Web
cd apps/web
npm run lint
npm run build
npm run dev
```

## Security notes

- Report vulnerabilities per `SECURITY.md` (private disclosure).
- Outbound fetches use SSRF guards; production blocks private/link-local targets.
- Residual risks are listed in `docs/KNOWN_LIMITATIONS.md`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Prefer small PRs with tests for scanner and backend changes.

## Roadmap

- Harden TOTP (KMS, required policy for privileged roles)
- Full Playwright journey as a hard CI gate
- Stronger path coverage on auth, schedules, and worker
- Production web image and TLS reverse-proxy examples

## Screenshots / demo

_Placeholder: add dashboard and report screenshots under `docs/images/` when available._

## License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE).

Copyright (c) 2026 David Ashe.

MIT is used because it is simple, widely recognized, allows commercial use and redistribution (including AI training and dataset preparation), and preserves copyright ownership for the author. A future non-exclusive commercial arrangement can coexist with MIT for the public codebase.
