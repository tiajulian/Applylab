import { describe, it, expect } from "vitest";
import { aiErrorResponse } from "./errorResponse";
import { AiUnavailableError, QuotaExceededError } from "./errors";

describe("aiErrorResponse", () => {
  it("turns a free-tier quota refusal into the existing FREE_LIMIT_REACHED upgrade contract", async () => {
    const res = aiErrorResponse(new QuotaExceededError("free", "resume", null))!;
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "FREE_LIMIT_REACHED", reason: "ai_credits" });
  });

  it("tells a Pro user when their monthly allowance resets", async () => {
    const res = aiErrorResponse(new QuotaExceededError("pro", "resume", new Date(Date.UTC(2026, 9, 1))))!;
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("AI_QUOTA_EXCEEDED");
    expect(body.error).toContain("1 October");
  });

  it("maps a tripped circuit breaker to 503 with Retry-After", () => {
    const res = aiErrorResponse(new AiUnavailableError(60))!;
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("ignores every other error", () => {
    expect(aiErrorResponse(new Error("boom"))).toBeNull();
  });
});
