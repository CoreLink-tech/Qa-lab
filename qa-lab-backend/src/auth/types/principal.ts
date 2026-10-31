/**
 * Unified authenticated principal (JWT user or API key).
 */
export type RequestPrincipal = {
  kind: 'user' | 'api_key';
  /** Present for JWT sessions */
  userId: string | null;
  email?: string;
  /** Present for API keys */
  apiKeyId?: string;
  organizationId?: string;
  scopes: string[];
};

/** Back-compat shape used by existing controllers */
export type AuthenticatedUser = {
  id: string;
  email: string;
  kind?: 'user' | 'api_key';
  userId?: string | null;
  apiKeyId?: string;
  organizationId?: string;
  scopes?: string[];
};

export function toAuthenticatedUser(p: RequestPrincipal): AuthenticatedUser {
  if (p.kind === 'user') {
    return {
      id: p.userId as string,
      email: p.email || '',
      kind: 'user',
      userId: p.userId,
      scopes: p.scopes,
    };
  }
  return {
    id: p.apiKeyId as string,
    email: '',
    kind: 'api_key',
    userId: p.userId,
    apiKeyId: p.apiKeyId,
    organizationId: p.organizationId,
    scopes: p.scopes,
  };
}
