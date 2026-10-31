# Contributing to QA Lab

Thank you for contributing. This document explains how to work on the project safely and consistently.

## Code of Conduct

Be respectful. Assume good intent. Focus on technical merit.

## Getting started

1. Fork and clone the repository.
2. Copy environment files:
   ```bash
   cp .env.example .env
   cp qa-lab-backend/.env.example qa-lab-backend/.env
   ```
3. Start infrastructure:
   ```bash
   docker compose up -d
   ```
4. Install dependencies:
   ```bash
   # CLI / scanner
   npm ci

   # Backend
   cd qa-lab-backend && npm ci
   ```
5. Run migrations (backend):
   ```bash
   cd qa-lab-backend
   npx prisma migrate dev
   ```
6. Run tests:
   ```bash
   # CLI
   npm test

   # Backend
   cd qa-lab-backend && npm test
   ```

## Branching & commits

- Branch from `main`.
- Use conventional commits:
  - `feat: …`
  - `fix: …`
  - `docs: …`
  - `refactor: …`
  - `test: …`
  - `chore: …`
  - `ci: …`
  - `perf: …`
- Keep PRs focused and reasonably sized.
- Reference issues where applicable.

## Architecture constraints (non-negotiable)

- Keep the root CLI in CommonJS / JavaScript unless a deliberate migration is agreed.
- New backend code is TypeScript.
- Scanner must remain usable as both CLI and importable library.
- Never execute user-supplied code.
- Security checks stay passive; no exploit payloads.
- All external input must be validated.
- Authorization checks belong in services / controllers, not only the UI.
- SSRF protections are mandatory for any user-supplied URL.

See `docs/ARCHITECTURE.md` for the full picture.

## Testing

- Every meaningful module and API flow needs tests.
- CLI: Node built-in test runner (`node --test "test/**/*.test.js"`).
- Backend: Jest (unit + e2e).
- Prefer deterministic tests; network-dependent tests should be clearly marked and skippable.

## Pull requests

- Fill out the PR template.
- Ensure CI is green (lint, typecheck, tests, build).
- Update docs / `ARCHITECTURE.md` when behavior or structure changes.
- Do not commit secrets, real tokens, or large generated artifacts.

## Security

- Report vulnerabilities privately to the maintainers.
- Never open a public issue that includes exploit details or live credentials.
- Rotate any token that has been exposed.

## Questions

Open a discussion or issue with the `question` label.
