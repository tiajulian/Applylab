import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

describe("verifyTurnstileToken", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false immediately without calling fetch if token is missing or empty", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    expect(await verifyTurnstileToken("")).toBe(false);
    expect(await verifyTurnstileToken(null)).toBe(false);
    expect(await verifyTurnstileToken(undefined)).toBe(false);
    expect(await verifyTurnstileToken("   ")).toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it("returns true when Cloudflare siteverify responds with success: true", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });

    const result = await verifyTurnstileToken("valid-token", "1.2.3.4");
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
    global.fetch = originalFetch;
  });

  it("returns false when Cloudflare siteverify responds with success: false", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: false, "error-codes": ["invalid-input-response"] }),
    });

    const result = await verifyTurnstileToken("invalid-token");
    expect(result).toBe(false);
    global.fetch = originalFetch;
  });

  it("returns false if fetch rejects with a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    const result = await verifyTurnstileToken("some-token");
    expect(result).toBe(false);
    global.fetch = originalFetch;
  });

  it("returns false if HTTP response status is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await verifyTurnstileToken("some-token");
    expect(result).toBe(false);
    global.fetch = originalFetch;
  });
});
