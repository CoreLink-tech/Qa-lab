# Authentication (WS3)

## Session model
- **Access token**: JWT (~15m), JSON body; web keeps it **in memory only**.
- **Refresh token**: opaque, 7d, **httpOnly cookie** `qalab_refresh` (path `/api/auth`); also in JSON for non-browser clients.
- **Rotation**: refresh revokes previous token; **reuse of a revoked token revokes the whole family**.
- **Login lockout**: 8 failed attempts → 15 minute lock.
- **Password hashing**: bcrypt cost **12**.

## Email
- `EMAIL_MODE=log` (default): verification/reset links logged by the API.
- Configure a real SMTP adapter before production open registration.

## Cookies / CORS
- Browser: `credentials: "include"`.
- `CORS_ORIGIN` = dashboard origin.
- Production: `COOKIE_SECURE=true`, `TRUST_PROXY=true`.

## Deferred
- CSRF double-submit for pure cookie SPA mutations.
- TOTP 2FA.
