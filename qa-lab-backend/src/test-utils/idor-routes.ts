/**
 * Canonical route catalog for cross-tenant (IDOR) coverage.
 * When adding a new authenticated controller method, add a row here
 * and a matching case in idor.matrix.spec.ts.
 */
export type IdorRoute = {
  method: string;
  path: string;
  auth: 'jwt' | 'jwt_or_api_key' | 'public';
  scopes?: string[];
  resource: string;
};

export const IDOR_ROUTES: IdorRoute[] = [
  { method: 'GET', path: '/api/auth/me', auth: 'jwt', resource: 'User' },
  {
    method: 'POST',
    path: '/api/auth/logout-all',
    auth: 'jwt',
    resource: 'User',
  },
  {
    method: 'POST',
    path: '/api/auth/change-password',
    auth: 'jwt',
    resource: 'User',
  },

  {
    method: 'GET',
    path: '/api/organizations',
    auth: 'jwt',
    resource: 'Organization',
  },
  {
    method: 'POST',
    path: '/api/organizations',
    auth: 'jwt',
    resource: 'Organization',
  },
  {
    method: 'GET',
    path: '/api/organizations/:id',
    auth: 'jwt',
    resource: 'Organization',
  },
  {
    method: 'PATCH',
    path: '/api/organizations/:id',
    auth: 'jwt',
    resource: 'Organization',
  },
  {
    method: 'POST',
    path: '/api/organizations/invite',
    auth: 'jwt',
    resource: 'Organization',
  },

  { method: 'GET', path: '/api/projects', auth: 'jwt', resource: 'Project' },
  { method: 'POST', path: '/api/projects', auth: 'jwt', resource: 'Project' },
  {
    method: 'GET',
    path: '/api/projects/:id',
    auth: 'jwt',
    resource: 'Project',
  },

  { method: 'GET', path: '/api/websites', auth: 'jwt', resource: 'Website' },
  { method: 'POST', path: '/api/websites', auth: 'jwt', resource: 'Website' },
  {
    method: 'GET',
    path: '/api/websites/:id',
    auth: 'jwt',
    resource: 'Website',
  },
  {
    method: 'POST',
    path: '/api/websites/:id/verify/start',
    auth: 'jwt',
    resource: 'Website',
  },
  {
    method: 'POST',
    path: '/api/websites/:id/verify/confirm',
    auth: 'jwt',
    resource: 'Website',
  },

  {
    method: 'POST',
    path: '/api/scans',
    auth: 'jwt_or_api_key',
    scopes: ['scans:write'],
    resource: 'Scan',
  },
  {
    method: 'GET',
    path: '/api/scans',
    auth: 'jwt_or_api_key',
    scopes: ['scans:read'],
    resource: 'Scan',
  },
  {
    method: 'GET',
    path: '/api/scans/:id',
    auth: 'jwt_or_api_key',
    scopes: ['scans:read'],
    resource: 'Scan',
  },
  {
    method: 'POST',
    path: '/api/scans/:id/cancel',
    auth: 'jwt_or_api_key',
    scopes: ['scans:write'],
    resource: 'Scan',
  },

  {
    method: 'POST',
    path: '/api/schedules',
    auth: 'jwt',
    resource: 'ScanSchedule',
  },
  {
    method: 'GET',
    path: '/api/schedules',
    auth: 'jwt',
    resource: 'ScanSchedule',
  },
  {
    method: 'PATCH',
    path: '/api/schedules/:id',
    auth: 'jwt',
    resource: 'ScanSchedule',
  },
  {
    method: 'DELETE',
    path: '/api/schedules/:id',
    auth: 'jwt',
    resource: 'ScanSchedule',
  },

  { method: 'POST', path: '/api/api-keys', auth: 'jwt', resource: 'ApiKey' },
  { method: 'GET', path: '/api/api-keys', auth: 'jwt', resource: 'ApiKey' },
  {
    method: 'DELETE',
    path: '/api/api-keys/:id',
    auth: 'jwt',
    resource: 'ApiKey',
  },
];
