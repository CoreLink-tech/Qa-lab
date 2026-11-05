# Known limitations

Canonical threat-model and residual risks also appear in `docs/ARCHITECTURE.md`.

## Authentication and sessions

- **TOTP 2FA**: library/service (`TotpService`) exists; enrollment, encrypted secret storage, recovery-code consumption, and OWNER/ADMIN enforcement are not fully wired end-to-end.
- **CSRF**: Origin/Referer middleware protects cookie-session mutations; double-submit cookie token is not yet used.
- Email defaults to **log-only**; set `EMAIL_MODE=smtp` + `SMTP_*` for real delivery (see `docs/AUTH.md`).

## Security scanning and SSRF

- SSRF is enforced at website create/update, scan enqueue, schedule create, and immediately before worker fetch.
- Worker wall-clock timeout aborts via `AbortSignal` through crawler + safeHttp; a single in-flight request may still complete.
- Scan process isolation (child process / worker thread with hard memory limits) is not fully implemented.

## Frontend

- Next.js CSP allows `'unsafe-inline'` for scripts/styles (Next requirement without a nonce pipeline). `'unsafe-eval'` has been removed.
- No Playwright e2e suite in CI yet.

## Coverage and testing

- CI coverage gates remain baseline (services-focused thresholds), not an 80% product-wide bar.
- Compose smoke e2e (full register → scan → report) is not yet a hard CI gate.
- Cross-tenant IDOR catalog exists; automatic generation from Nest metadata is incomplete.

## Operations

- Plan tiers are code defaults only — no billing integration.
- Metrics are per process; scrape each replica.
- Production compose includes api, worker, postgres, redis, migrate profile, and a web placeholder; reverse-proxy TLS example is documented in OPERATIONS, not fully baked into compose.
