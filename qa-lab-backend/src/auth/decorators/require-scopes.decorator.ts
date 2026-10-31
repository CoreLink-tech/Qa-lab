import { SetMetadata } from '@nestjs/common';

export const SCOPES_KEY = 'required_scopes';

/** Route requires ALL listed scopes (API keys). JWT users are treated as full access. */
export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(SCOPES_KEY, scopes);
