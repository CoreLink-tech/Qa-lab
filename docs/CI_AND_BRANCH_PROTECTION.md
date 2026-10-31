# CI and branch protection

## Required GitHub status checks (Settings → Branches → main)

Enable **Require status checks to pass before merging** and select:

- `Scanner tests (20.x)` / `Scanner tests (22.x)` (matrix job name may appear as `scanner`)
- `Backend lint, typecheck, build, test`
- `Web lint, typecheck, build`
- `Docker image build` (optional but recommended)
- `Analyze` (CodeQL), if enabled

Also enable:

- Require a pull request before merging (recommended for collaborators)
- Require linear history (optional)
- Do not allow bypassing (admins included) for production repos

## Local lightweight checks (Termux-friendly)

```bash
# Scanner
npm ci && npm test

# Backend (needs lockfile; generate client without DB)
cd qa-lab-backend
npm ci
npm run prisma:generate
npm run lint
npm run typecheck
npm test

# Web
cd apps/web
npm ci
npm run typecheck
npm run build
```

Heavy checks (Postgres/Redis integration, Docker build) run in GitHub Actions.
