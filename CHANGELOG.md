# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-05

### Added

- MIT License (`LICENSE`) with copyright held by David Ashe
- Scanner CLI and library (`src/`) for website QA (performance, SEO, accessibility, links, forms, security headers)
- NestJS multi-tenant API (`qa-lab-backend/`) with auth, organizations, projects, websites, scans, schedules, API keys
- BullMQ worker process with wall-clock timeout and optional child-process isolation (`SCAN_ISOLATION=child`)
- Next.js dashboard (`apps/web/`)
- SSRF protection at website create/update, scan enqueue, schedule create, and pre-fetch
- CSRF Origin middleware for cookie-session mutations
- TOTP helpers and enrollment endpoints (`/api/auth/totp/setup`, `/confirm`)
- Docker Compose (dev + production-oriented) and multi-stage Dockerfile (api/worker targets)
- GitHub Actions CI (scanner tests, backend lint/typecheck/build/test, web build, Docker smoke, Trivy, CodeQL)
- Documentation under `docs/` (architecture, auth, worker, quotas, testing, operations)

### Security

- Production ignores private-network SSRF bypass flags
- API keys hashed with scrypt
- Linear-time slugify (no polynomial regex on user input)
- Technology detection uses URL hostname parsing rather than incomplete substring checks

### Documentation

- Honest `docs/KNOWN_LIMITATIONS.md`
- `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- Root and backend `.env.example` without real secrets

### Known issues

- TOTP enrollment is API-level; KMS encryption of secrets and required-2FA policy for OWNER/ADMIN are incomplete
- Playwright full product journey is not a hard CI gate
- Coverage thresholds are baseline on most paths; stricter on quotas/totp/api-keys
- Dashboard and billing integrations are minimal or absent

[0.1.0]: https://github.com/CoreLink-tech/Qa-lab/releases/tag/v0.1.0
