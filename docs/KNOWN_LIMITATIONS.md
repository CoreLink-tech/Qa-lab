# Known limitations

Canonical list lives in **§8 of `docs/ARCHITECTURE.md`**.  
Do not claim the system is “production-grade” in product copy until that section is empty or accepted as residual risk by the operator.

Highlights:

- Email is log-only by default.
- No TOTP 2FA.
- Test coverage gates are baseline, not 80%.
- Open registration without CAPTCHA/email proof in production is risky.
- Worker timeouts do not always abort in-flight crawler I/O.
- Next.js CSP still permits unsafe inline/eval without a nonce pipeline.
