import { validateEnvironment } from './env.validation';

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long',
    ...overrides,
  };
}

describe('validateEnvironment', () => {
  it('accepts a fully valid configuration', () => {
    expect(() => validateEnvironment(validConfig())).not.toThrow();
  });

  it('applies defaults for NODE_ENV, PORT, and REDIS_PORT when omitted', () => {
    const rest = { ...validConfig() };
    delete (rest as { NODE_ENV?: string }).NODE_ENV;
    delete (rest as { PORT?: string }).PORT;
    delete (rest as { REDIS_PORT?: string }).REDIS_PORT;
    const result = validateEnvironment(rest);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.REDIS_PORT).toBe(6379);
  });

  it('throws when DATABASE_URL is missing', () => {
    const rest = { ...validConfig() };
    delete (rest as { DATABASE_URL?: string }).DATABASE_URL;
    expect(() => validateEnvironment(rest)).toThrow(
      /Environment validation failed/,
    );
  });

  it('throws when JWT_ACCESS_SECRET is missing', () => {
    const rest = { ...validConfig() };
    delete (rest as { JWT_ACCESS_SECRET?: string }).JWT_ACCESS_SECRET;
    expect(() => validateEnvironment(rest)).toThrow();
  });

  it('throws when JWT_REFRESH_SECRET is missing', () => {
    const rest = { ...validConfig() };
    delete (rest as { JWT_REFRESH_SECRET?: string }).JWT_REFRESH_SECRET;
    expect(() => validateEnvironment(rest)).toThrow();
  });

  it('throws on an invalid NODE_ENV value', () => {
    expect(() =>
      validateEnvironment(validConfig({ NODE_ENV: 'staging' })),
    ).toThrow();
  });

  it('throws on a PORT outside the valid 1-65535 range', () => {
    expect(() => validateEnvironment(validConfig({ PORT: '99999' }))).toThrow();
    expect(() => validateEnvironment(validConfig({ PORT: '0' }))).toThrow();
  });

  it('throws on a REDIS_PORT outside the valid range', () => {
    expect(() =>
      validateEnvironment(validConfig({ REDIS_PORT: '-1' })),
    ).toThrow();
  });

  it('allows REDIS_PASSWORD and CORS_ORIGIN to be omitted (optional)', () => {
    expect(() => validateEnvironment(validConfig())).not.toThrow();
  });

  it('throws on a malformed CORS_ORIGIN when provided', () => {
    expect(() =>
      validateEnvironment(validConfig({ CORS_ORIGIN: 'not a url at all' })),
    ).toThrow();
  });

  it('accepts a well-formed CORS_ORIGIN when provided', () => {
    expect(() =>
      validateEnvironment(validConfig({ CORS_ORIGIN: 'https://example.com' })),
    ).not.toThrow();
  });
});
