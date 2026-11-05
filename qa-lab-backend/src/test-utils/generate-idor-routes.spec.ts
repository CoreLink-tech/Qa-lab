import {
  assertIdorCatalogComplete,
  REQUIRED_PREFIXES,
} from './generate-idor-routes';
import { IDOR_ROUTES } from './idor-routes';

describe('IDOR route catalog completeness', () => {
  it('covers required API prefixes', () => {
    expect(() => assertIdorCatalogComplete()).not.toThrow();
  });

  it('lists required prefixes for maintainers', () => {
    expect(REQUIRED_PREFIXES.length).toBeGreaterThan(5);
  });

  it('has only known auth modes', () => {
    for (const r of IDOR_ROUTES) {
      expect(['jwt', 'jwt_or_api_key', 'public']).toContain(r.auth);
    }
  });
});
