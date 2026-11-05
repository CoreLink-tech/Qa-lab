# npm audit exceptions (high+)

Last reviewed: 2026-11-02
Next review / expiry: 2026-12-15

## apps/web

- **postcss** (via next@15): high advisories GHSA-qx2v-qp2m-jg93 et al.
  - Reason: Next 15 pins an older postcss; upgrading requires Next 16 (tracked in Phase 5 / Dependabot).
  - Mitigation: postcss is build-time only; no runtime exposure of the stringify / source-map paths in our dashboard.
  - Action: address with Next 16 major in Phase 5.

## Root / backend

- None currently (overrides applied for multer, js-yaml; axios/follow-redirects/undici cleaned by audit fix).
