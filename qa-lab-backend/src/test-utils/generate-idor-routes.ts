/**
 * Ensures IDOR_ROUTES stays complete relative to known controllers.
 * Run in CI / unit test: if a controller path prefix is missing from the catalog, fail.
 */
import { IDOR_ROUTES } from './idor-routes';

/** High-level path prefixes that must appear at least once in the catalog */
export const REQUIRED_PREFIXES = [
  '/api/auth',
  '/api/organizations',
  '/api/projects',
  '/api/websites',
  '/api/scans',
  '/api/api-keys',
  '/api/schedules',
];

export function assertIdorCatalogComplete(): void {
  const paths = IDOR_ROUTES.map((r) => r.path);
  for (const prefix of REQUIRED_PREFIXES) {
    const hit = paths.some((p) => p === prefix || p.startsWith(prefix + '/'));
    if (!hit) {
      throw new Error(
        `IDOR catalog missing routes for prefix ${prefix}. Add them to idor-routes.ts`,
      );
    }
  }
}
