import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  api,
  clearSession,
  getAccessToken,
  login,
  refreshSession,
  register,
  setAccessToken,
} from "../api";

describe("ApiError", () => {
  it("sets status, message, and name", () => {
    const err = new ApiError(401, "Unauthorized", { code: "NOPE" });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(401);
    expect(err.message).toBe("Unauthorized");
    expect(err.name).toBe("ApiError");
    expect(err.details).toEqual({ code: "NOPE" });
  });
});

describe("api client", () => {
  beforeEach(() => {
    clearSession();
    vi.stubGlobal(
      "fetch",
      vi.fn(),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("returns JSON on success", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ ok: true }),
    });
    const data = await api<{ ok: boolean }>("/health", { auth: false });
    expect(data.ok).toBe(true);
  });

  it("throws ApiError on non-ok response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 400,
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ message: "invalid" }),
    });
    await expect(api("/x", { auth: false })).rejects.toMatchObject({
      status: 400,
      message: "invalid",
    });
  });

  it("joins array messages from API", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 422,
      ok: false,
      statusText: "Unprocessable",
      json: async () => ({ message: ["a", "b"] }),
    });
    await expect(api("/x", { auth: false })).rejects.toMatchObject({
      message: "a, b",
    });
  });

  it("sends Authorization when token present", async () => {
    setAccessToken("tok123");
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({}),
    });
    await api("/me");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok123",
        }),
      }),
    );
  });

  it("register stores session from response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({
        user: { id: "u1", email: "a@b.com", status: "ACTIVE" },
        tokens: { accessToken: "access", expiresIn: 900 },
        organization: { id: "o1", name: "Org", slug: "org", role: "OWNER" },
      }),
    });
    const data = await register({
      email: "a@b.com",
      password: "Str0ng!Pass1",
    });
    expect(data.user.email).toBe("a@b.com");
    expect(getAccessToken()).toBe("access");
  });

  it("login stores session", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        user: { id: "u1", email: "a@b.com", status: "ACTIVE" },
        tokens: { accessToken: "login-tok", expiresIn: 900 },
      }),
    });
    await login({ email: "a@b.com", password: "x" });
    expect(getAccessToken()).toBe("login-tok");
  });

  it("refreshSession updates access token", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        user: { id: "u1", email: "a@b.com", status: "ACTIVE" },
        tokens: { accessToken: "refreshed", expiresIn: 900 },
      }),
    });
    await refreshSession();
    expect(getAccessToken()).toBe("refreshed");
  });

  it("handles 204 with no body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => {
        throw new Error("no body");
      },
    });
    await expect(api("/logout", { method: "POST", auth: false })).resolves.toBeUndefined();
  });

  it("clearSession drops token", () => {
    setAccessToken("x");
    clearSession();
    expect(getAccessToken()).toBeNull();
  });

  it("register failure throws ApiError", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 409,
      ok: false,
      statusText: "Conflict",
      json: async () => ({ message: "exists" }),
    });
    await expect(
      register({ email: "a@b.com", password: "x" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
