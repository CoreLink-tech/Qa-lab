# Known limitations

Canonical residual risks for operators.

## Authentication and sessions

- **TOTP 2FA**: schema fields + `TotpService` + login enforcement when `totpEnabled` are implemented. Enrollment API, KMS encryption of `totpSecretEnc`, recovery-code consumption, and OWNER/ADMIN *required* policy are not fully productized.
- **CSRF**: Origin/Referer middleware protects cookie-session mutations; double-submit cookie token is not yet used.
- Email defaults to **log-only**; set `EMAIL_MODE=smtp` + `SMTP_*` for real delivery (see `docs/AUTH.md`).

## Security scanning and SSRF

- SSRF is enforced at website create/update, scan enqueue, schedule create, and immediately before worker fetch.
- Worker wall-clock timeout aborts via `AbortSignal`. Optional child-process isolation via `SCAN_ISOLATION=child`.
- Default isolation is in-process for local/dev simplicity.

## Frontend

- Next.js CSP allows `'unsafe-inline'` for scripts/styles (Next without nonces). `'unsafe-eval'` removed.
- Playwright smoke config exists; full product journey suite is still thin.

## Coverage and testing

- CI coverage gates: global baseline + stricter path thresholds on quotas, totp, api-keys.
- Cross-tenant IDOR catalog completeness is tested; full Nest metadata reflection is not automated.

## Operations

- Plan tiers are code defaults only — no billing integration.
- Metrics are per process; scrape each replica.
- Trivy filesystem scan runs in CI (HIGH/CRITICAL, ignore unfixed).
- Production compose includes api, worker, postgres, redis, migrate profile, web placeholder.
