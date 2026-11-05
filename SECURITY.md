# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| `main`  | Yes (active development) |
| Tagged releases (`v0.x`) | Best-effort security fixes |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email the maintainer at the address associated with the repository owner, or use GitHub **Private vulnerability reporting** (Security tab → Advisories → Report a vulnerability) if enabled.

Include:

- Description of the issue
- Steps to reproduce
- Affected component (scanner CLI, API, worker, dashboard)
- Potential impact

You should receive an acknowledgement within 7 days. Coordinated disclosure is preferred.

## Security design notes

- Outbound crawl/fetch traffic is gated by an SSRF guard (`src/utils/ssrfGuard.js`, `safeHttp.js`) with DNS pinning and private-IP blocking in production.
- Authentication uses JWT access tokens, rotating refresh tokens (HTTP-only cookie), optional API keys (scrypt-hashed), and optional TOTP.
- Secrets must be supplied via environment variables; never commit `.env` files.
- See `docs/KNOWN_LIMITATIONS.md` for residual risks.
