import { describe, expect, it, vi } from "vitest";
import { rememberBridgeJobAd } from "./rememberBridgeJobAd";
import { hashForScoring } from "./scoreCache";
import type { createClient } from "@/lib/supabase/server";

describe("Skill Gap job identity metadata", () => {
  it("binds metadata to the owner, linked analysis and original source hash", async () => {
    const query = { eq: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
    const update = vi.fn(() => query);
    await rememberBridgeJobAd({ from: vi.fn(() => ({ update })) } as unknown as ReturnType<typeof createClient>, "bridge", "user", "source-hash", "the ad");
    expect(update).toHaveBeenCalledWith({ job_ad_hash: hashForScoring("the ad") });
    expect(query.eq.mock.calls).toEqual([["id", "bridge"], ["user_id", "user"], ["job_description_hash", "source-hash"]]);
  });
  it("preserves existing Skill Gap flows before the optional column is applied", async () => {
    const query = { eq: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => resolve({ error: { code: "PGRST204" } }) };
    await expect(rememberBridgeJobAd({ from: vi.fn(() => ({ update: () => query })) } as unknown as ReturnType<typeof createClient>, "bridge", "user", "source", "ad")).resolves.toBeUndefined();
  });
});
