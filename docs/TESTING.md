# Testing (WS7)

## Unit
```bash
cd qa-lab-backend && npm test
cd qa-lab-backend && npm run test:cov
```

Coverage gate (global, modest baseline to grow in CI):
- statements ≥ 30%, branches ≥ 20%, functions ≥ 25%, lines ≥ 30% (enforced in `package.json` `coverageThreshold`; raise over time toward 80%)

Exclusions: generated Prisma client, `main.ts` / `main.worker.ts`, Nest modules.

## IDOR matrix
- Route catalog: `src/test-utils/idor-routes.ts` — **add a row for every new authenticated route**
- Tests: `src/auth/guards/idor.matrix.spec.ts` + service boundary tests

## Integration (CI)
GitHub Actions `backend` job uses Postgres + Redis service containers, runs migrate + unit tests + **e2e health** (`npm run test:e2e`).

```bash
cd qa-lab-backend && npm run test:e2e
```

E2E suites: `health.e2e-spec.ts` (live/ready/health), `auth.e2e-spec.ts` (register/login/me).


## Load smoke
```bash
node scripts/load-smoke.mjs http://localhost:3000/api 10 50
```
Targets health only (no auth). For authenticated soak, extend with a test token.

## Web
```bash
cd apps/web && npm run typecheck && npm run build
```
Playwright e2e is deferred until a stable fixture stack is in CI.
