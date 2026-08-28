import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndRecordRateLimit } from "./rateLimit";

describe("checkAndRecordRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the request and records a hit when under the limit", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 2, error: null }),
          }),
        }),
        insert: insertMock,
      }),
    };

    const allowed = await checkAndRecordRateLimit(
      mockSupabase as never,
      "test_key",
      5,
      60_000
    );

    expect(allowed).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("rate_limit_hits");
    expect(insertMock).toHaveBeenCalledWith({ rate_key: "test_key" });
  });

  it("rejects the request and skips inserting when at or over the limit", async () => {
    const insertMock = vi.fn();
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
        insert: insertMock,
      }),
    };

    const allowed = await checkAndRecordRateLimit(
      mockSupabase as never,
      "test_key",
      5,
      60_000
    );

    expect(allowed).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("handles null count as 0 hits and allows the request", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: null, error: null }),
          }),
        }),
        insert: insertMock,
      }),
    };

    const allowed = await checkAndRecordRateLimit(
      mockSupabase as never,
      "test_key",
      5,
      60_000
    );

    expect(allowed).toBe(true);
    expect(insertMock).toHaveBeenCalledWith({ rate_key: "test_key" });
  });
});
