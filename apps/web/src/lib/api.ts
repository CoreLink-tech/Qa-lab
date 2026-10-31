/**
 * QA Lab API client.
 * Access token: in-memory only (XSS cannot read a long-lived refresh from JS if refresh is httpOnly cookie).
 * Refresh: httpOnly cookie set by API (credentials: include) with optional body fallback.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
};

export type UserSummary = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  status: string;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount?: number;
  projectCount?: number;
};

export type ProjectSummary = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
  websiteCount?: number;
  scanCount?: number;
};

export type WebsiteSummary = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  isActive: boolean;
};

export type ScanSummary = {
  id: string;
  websiteId: string;
  projectId: string;
  status: string;
  trigger: string;
  pagesScanned?: number | null;
  score?: number | null;
  grade?: string | null;
  issueCount?: number | null;
  queuedAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  website?: { id: string; name: string; url: string };
};

export type ScanDetail = ScanSummary & {
  options?: Record<string, unknown> | null;
  error?: string | null;
  report?: {
    id: string;
    score: number | null;
    grade: string | null;
    issueCount: number;
    reportJson: unknown;
    reportHtml?: string | null;
  } | null;
};

const USER_KEY = "qalab_user";
const ORG_KEY = "qalab_org";

/** In-memory access token — not persisted to localStorage */
let accessTokenMemory: string | null = null;

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export function setAccessToken(token: string | null) {
  accessTokenMemory = token;
}

export function setStoredSession(
  tokens: AuthTokens,
  user: UserSummary,
  org?: OrganizationSummary,
) {
  setAccessToken(tokens.accessToken);
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (org) localStorage.setItem(ORG_KEY, JSON.stringify(org));
    // Clear any legacy token storage
    localStorage.removeItem("qalab_tokens");
  }
}

export function getStoredUser(): UserSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserSummary) : null;
  } catch {
    return null;
  }
}

export function getStoredOrg(): OrganizationSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ORG_KEY);
    return raw ? (JSON.parse(raw) as OrganizationSummary) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  accessTokenMemory = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ORG_KEY);
    localStorage.removeItem("qalab_tokens");
  }
}

/** @deprecated use getAccessToken */
export function getStoredTokens(): AuthTokens | null {
  const t = getAccessToken();
  return t ? { accessToken: t, expiresIn: 0 } : null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (data as { message?: string | string[] }).message ||
      res.statusText ||
      "Request failed";
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(", ") : String(message),
      data,
    );
  }

  return data as T;
}

export async function register(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
}) {
  const data = await api<{
    user: UserSummary;
    tokens: AuthTokens;
    organization?: OrganizationSummary;
  }>("/auth/register", { method: "POST", body: input, auth: false });
  setStoredSession(data.tokens, data.user, data.organization);
  return data;
}

export async function login(input: { email: string; password: string }) {
  const data = await api<{
    user: UserSummary;
    tokens: AuthTokens;
    organization?: OrganizationSummary;
  }>("/auth/login", { method: "POST", body: input, auth: false });
  setStoredSession(data.tokens, data.user, data.organization);
  return data;
}

export async function refreshSession() {
  const data = await api<{
    user: UserSummary;
    tokens: AuthTokens;
    organization?: OrganizationSummary;
  }>("/auth/refresh", { method: "POST", body: {}, auth: false });
  setStoredSession(data.tokens, data.user, data.organization);
  return data;
}

export async function logout() {
  try {
    await api("/auth/logout", { method: "POST", body: {}, auth: false });
  } catch {
    /* ignore */
  }
  clearSession();
}

export async function fetchMe() {
  return api<{
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    status: string;
    emailVerifiedAt?: string | null;
    organizations: OrganizationSummary[];
  }>("/auth/me");
}

export const organizations = {
  list: () => api<OrganizationSummary[]>("/organizations"),
  get: (id: string) =>
    api<OrganizationSummary & { members?: unknown[] }>(`/organizations/${id}`),
  create: (body: { name: string; slug?: string }) =>
    api<OrganizationSummary>("/organizations", { method: "POST", body }),
};

export const projects = {
  list: (organizationId: string) =>
    api<ProjectSummary[]>(`/projects?organizationId=${organizationId}`),
  get: (id: string) =>
    api<ProjectSummary & { websites: WebsiteSummary[] }>(`/projects/${id}`),
  create: (body: {
    organizationId: string;
    name: string;
    slug?: string;
    description?: string;
  }) => api<ProjectSummary>("/projects", { method: "POST", body }),
};

export const websites = {
  list: (projectId: string) =>
    api<WebsiteSummary[]>(`/websites?projectId=${projectId}`),
  create: (body: { projectId: string; name: string; url: string }) =>
    api<WebsiteSummary>("/websites", { method: "POST", body }),
};

export const scans = {
  listByWebsite: (websiteId: string) =>
    api<ScanSummary[]>(`/scans?websiteId=${websiteId}`),
  listByProject: (projectId: string) =>
    api<ScanSummary[]>(`/scans?projectId=${projectId}`),
  get: (id: string) => api<ScanDetail>(`/scans/${id}`),
  create: (body: {
    websiteId: string;
    maxPages?: number;
    maxDepth?: number;
    checkExposedPaths?: boolean;
  }) => api<ScanSummary>("/scans", { method: "POST", body }),
  cancel: (id: string) =>
    api<{ id: string; status: string }>(`/scans/${id}/cancel`, {
      method: "POST",
    }),
};

export type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  createdAt: string;
};

export type ScheduleSummary = {
  id: string;
  websiteId: string;
  intervalHours: number;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
};

export const apiKeys = {
  list: (organizationId: string) =>
    api<ApiKeySummary[]>(`/api-keys?organizationId=${organizationId}`),
  create: (body: {
    organizationId: string;
    name: string;
    scopes?: string[];
  }) =>
    api<ApiKeySummary & { key: string; warning: string }>("/api-keys", {
      method: "POST",
      body,
    }),
  revoke: (keyId: string) =>
    api<{ id: string; revoked: boolean }>(`/api-keys/${keyId}`, {
      method: "DELETE",
    }),
};

export const schedules = {
  list: (websiteId: string) =>
    api<ScheduleSummary[]>(`/schedules?websiteId=${websiteId}`),
  create: (body: {
    websiteId: string;
    intervalHours?: number;
    maxPages?: number;
    maxDepth?: number;
  }) => api<ScheduleSummary>("/schedules", { method: "POST", body }),
  setEnabled: (id: string, enabled: boolean) =>
    api<ScheduleSummary>(`/schedules/${id}`, {
      method: "PATCH",
      body: { enabled },
    }),
  remove: (id: string) =>
    api<{ id: string; deleted: boolean }>(`/schedules/${id}`, {
      method: "DELETE",
    }),
};
