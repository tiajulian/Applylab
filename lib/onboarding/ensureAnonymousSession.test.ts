import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureAnonymousSession } from "./ensureAnonymousSession";

describe("ensureAnonymousSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call signInAnonymously if an active session already exists", async () => {
    const signInAnonymouslyMock = vi.fn();
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-123" } } },
          error: null,
        }),
        signInAnonymously: signInAnonymouslyMock,
      },
    };

    const { error } = await ensureAnonymousSession(
      mockSupabase as never,
      "turnstile-token-123"
    );

    expect(error).toBeNull();
    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
  });

  it("calls signInAnonymously with captchaToken when no session exists", async () => {
    const signInAnonymouslyMock = vi.fn().mockResolvedValue({
      data: { user: { id: "anon-user-1" }, session: {} },
      error: null,
    });
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        signInAnonymously: signInAnonymouslyMock,
      },
    };

    const { error } = await ensureAnonymousSession(
      mockSupabase as never,
      "turnstile-token-123"
    );

    expect(error).toBeNull();
    expect(signInAnonymouslyMock).toHaveBeenCalledWith({
      options: { captchaToken: "turnstile-token-123" },
    });
  });

  it("returns error without throwing if signInAnonymously returns an auth error", async () => {
    const authError = new Error("Captcha verification failed");
    const signInAnonymouslyMock = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: authError,
    });
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        signInAnonymously: signInAnonymouslyMock,
      },
    };

    const { error } = await ensureAnonymousSession(
      mockSupabase as never,
      "invalid-token"
    );

    expect(error).toBe(authError);
    expect(signInAnonymouslyMock).toHaveBeenCalledWith({
      options: { captchaToken: "invalid-token" },
    });
  });

  it("catches network or fetch exceptions and returns error safely", async () => {
    const mockSupabase = {
      auth: {
        getSession: vi.fn().mockRejectedValue(new Error("Network connection dropped")),
      },
    };

    const { error } = await ensureAnonymousSession(
      mockSupabase as never,
      "some-token"
    );

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("Network connection dropped");
  });
});
