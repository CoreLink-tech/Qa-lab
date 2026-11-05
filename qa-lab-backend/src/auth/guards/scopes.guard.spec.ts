import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ScopesGuard } from './scopes.guard';

describe('ScopesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new ScopesGuard(reflector as unknown as Reflector);

  function ctx(user: unknown) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as never;
  }

  it('allows JWT users without checking scopes', () => {
    reflector.getAllAndOverride.mockReturnValue(['scans:write']);
    expect(guard.canActivate(ctx({ kind: 'user', id: 'u1', scopes: [] }))).toBe(
      true,
    );
  });

  it('blocks API keys missing scope', () => {
    reflector.getAllAndOverride.mockReturnValue(['scans:write']);
    expect(() =>
      guard.canActivate(
        ctx({ kind: 'api_key', id: 'k1', scopes: ['scans:read'] }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows API keys with required scope', () => {
    reflector.getAllAndOverride.mockReturnValue(['scans:read']);
    expect(
      guard.canActivate(
        ctx({ kind: 'api_key', id: 'k1', scopes: ['scans:read'] }),
      ),
    ).toBe(true);
  });
});
