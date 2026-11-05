/**
 * Optional Sentry-compatible error reporting via env.
 * Set SENTRY_DSN to enable; without it, errors only go to structured logs.
 * Justification: no hard dependency — load @sentry/node only if present.
 */
export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // Optional peer: operators install @sentry/node if they want it
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      captureException: (e: unknown, ctx?: object) => void;
      init?: (o: object) => void;
    };
    Sentry.captureException(err, { extra: context });
  } catch {
    // Package not installed — ignore
  }
}

export function initErrorTracking(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      init: (o: object) => void;
    };
    Sentry.init({ dsn, tracesSampleRate: 0.05 });
  } catch {
    // optional
  }
}
