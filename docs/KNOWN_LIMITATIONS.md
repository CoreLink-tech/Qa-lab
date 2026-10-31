# Known limitations

Canonical list lives in **§8 of `docs/ARCHITECTURE.md`**.  
Do not claim the system is “production-grade” in product copy until that section is empty or accepted as residual risk by the operator.

Highlights:

- Email defaults to **log-only**; set `EMAIL_MODE=smtp` + `SMTP_*` for real delivery (see `docs/AUTH.md`).
- No TOTP 2FA.
- Test coverage gates are baseline (≥30% lines in CI), not 80%.
- Open registration without CAPTCHA / strong email proof in production is risky.
- Worker wall-clock timeout aborts the scan `AbortSignal` through crawler + safeHttp; rare in-flight edge cases may still complete a single request.
- Next.js CSP still permits unsafe inline/eval without a nonce pipeline.
- No Playwright e2e in CI yet.
- Plan tiers are code defaults only — no billing integration.
- Metrics are per process; scrape each replica.
