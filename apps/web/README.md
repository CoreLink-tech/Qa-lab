# QA Lab Dashboard

Next.js (App Router) web UI for the QA Lab platform.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- Talks to the NestJS API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3000/api`)

## Pages

| Route | Purpose |
|-------|---------|
| `/login`, `/register` | Auth |
| `/dashboard` | Overview — projects + recent scans |
| `/projects` | List / create projects |
| `/projects/[id]` | Websites, run scans, scan history |
| `/scans` | All scans |
| `/scans/[id]` | Scan detail, score, findings (polls while running) |
| `/organizations` | Workspaces |

## Local development

```bash
# Terminal 1 — API (from repo root)
docker compose up -d
cd qa-lab-backend && cp .env.example .env   # set JWT secrets
npm install && npx prisma migrate deploy && npx prisma generate
npm run start:dev

# Terminal 2 — Dashboard
cd apps/web
cp .env.example .env.local
npm install
npm run dev
# http://localhost:3001
```

## Notes

- Access tokens are stored in `localStorage` for the scaffold. Production should use httpOnly cookies + refresh rotation.
- CORS on the API should allow `http://localhost:3001` (`CORS_ORIGIN` in backend `.env`).
- This is a functional scaffold, not a polished design system. Extend components under `src/components/` as the product grows.
