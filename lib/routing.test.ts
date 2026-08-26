import { describe, expect, it, vi } from "vitest";
import { isFirstRunUser } from "./routing";

function mockSupabase(result: { count?: number | null; error?: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from };
}

describe("isFirstRunUser", () => {
  it("returns false without querying when resumesUsed is positive", async () => {
    const supabase = mockSupabase({ count: 0, error: null });
    await expect(isFirstRunUser(supabase as never, "user-1", 1)).resolves.toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns true when the application count query succeeds with zero", async () => {
    const supabase = mockSupabase({ count: 0, error: null });
    await expect(isFirstRunUser(supabase as never, "user-1", 0)).resolves.toBe(true);
  });

  it("returns false when the application count query errors, even if count is 0", async () => {
    const supabase = mockSupabase({ count: 0, error: new Error("connection reset") });
    await expect(isFirstRunUser(supabase as never, "user-1", 0)).resolves.toBe(false);
  });

  it("returns false when the application count is null", async () => {
    const supabase = mockSupabase({ count: null, error: null });
    await expect(isFirstRunUser(supabase as never, "user-1", 0)).resolves.toBe(false);
  });

  it("returns false when there are existing applications", async () => {
    const supabase = mockSupabase({ count: 3, error: null });
    await expect(isFirstRunUser(supabase as never, "user-1", 0)).resolves.toBe(false);
  });
});
