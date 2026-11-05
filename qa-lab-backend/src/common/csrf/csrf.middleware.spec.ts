import { BadRequestException } from '@nestjs/common';
import { CsrfOriginMiddleware } from './csrf.middleware';

describe('CsrfOriginMiddleware', () => {
  const config = {
    get: (k: string) =>
      k === 'CORS_ORIGIN' || k === 'cors.origin'
        ? 'http://localhost:3001'
        : undefined,
  };
  const mw = new CsrfOriginMiddleware(config as never);

  function req(
    partial: Record<string, unknown>,
  ): Parameters<CsrfOriginMiddleware['use']>[0] {
    return partial as never;
  }

  it('skips GET', () => {
    const next = jest.fn();
    mw.use(req({ method: 'GET', headers: {}, cookies: {} }), {} as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips when no refresh cookie', () => {
    const next = jest.fn();
    mw.use(
      req({ method: 'POST', headers: {}, cookies: {} }),
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('allows matching Origin with cookie', () => {
    const next = jest.fn();
    mw.use(
      req({
        method: 'POST',
        headers: { origin: 'http://localhost:3001' },
        cookies: { qalab_refresh: 'tok' },
      }),
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('rejects bad Origin with cookie', () => {
    expect(() =>
      mw.use(
        req({
          method: 'POST',
          headers: { origin: 'https://evil.example' },
          cookies: { qalab_refresh: 'tok' },
        }),
        {} as never,
        jest.fn(),
      ),
    ).toThrow(BadRequestException);
  });
});
