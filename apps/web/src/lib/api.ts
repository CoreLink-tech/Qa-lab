/**
 * Thin fetch client for the QA Lab backend API.
 * Tokens are stored in localStorage (scaffold). Move to httpOnly cookies for production.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
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

const TOKEN_KEY = "qalab_tokens";
const USER_KEY = "qalab_user";
const ORG_KEY = "qalab_org";

export function getStoredTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(
  tokens: AuthTokens,
  user: UserSummary,
  org?: OrganizationSummary,
) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (org) localStorage.setItem(ORG_KEY, JSON.stringify(org));
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
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ORG_KEY);
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

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
    const tokens = getStoredTokens();
    if (tokens?.accessToken) {
      headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

// ---- Auth ----

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

export async function logout() {
  const tokens = getStoredTokens();
  if (tokens?.refreshToken) {
    try {
      await api("/auth/logout", {
        method: "POST",
        body: { refreshToken: tokens.refreshToken },
        auth: false,
      });
    } catch {
      /* ignore */
    }
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
    organizations: OrganizationSummary[];
  }>("/auth/me");
}

// ---- Domain ----

export const organizations = {
  list: () => api<OrganizationSummary[]>("/organizations"),
  get: (id: string) => api<OrganizationSummary & { members?: unknown[] }>(`/organizations/${id}`),
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
