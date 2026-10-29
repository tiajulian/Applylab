import { describe, expect, it, vi } from "vitest";
import { fetchReviewSkillGap } from "./fetchReviewSkillGap";
import { hashForScoring } from "./scoreCache";
import type { createClient } from "@/lib/supabase/server";

function client(hash = hashForScoring("the ad"), bridgeError: unknown = null, adHash?: string) {
  const bridge = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "bridge", job_description_hash: hash, job_ad_hash: adHash }, error: bridgeError }) };
  const items = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [{ id: "item" }] }) };
  const from = vi.fn((table: string) => table === "skills_bridges" ? bridge : items);
  return { supabase: { from } as unknown as ReturnType<typeof createClient>, from, bridge };
}
describe("linked review Skill Gap loading", () => {
  it("supports uploaded resumes through the independent verified ad fingerprint", async () => {
    const { supabase } = client("upload-and-ad-hash", null, hashForScoring("the ad"));
    expect(await fetchReviewSkillGap(supabase, { skills_bridge_id: "bridge", job_description: "the ad" }, "user")).not.toBeNull();
    expect(await fetchReviewSkillGap(supabase, { skills_bridge_id: "bridge", job_description: "changed ad" }, "user")).toBeNull();
  });
  it("loads the exact linked, owned analysis only for the same ad", async () => {
    const { supabase, bridge } = client();
    expect(await fetchReviewSkillGap(supabase, { skills_bridge_id: "bridge", job_description: "the ad" }, "user")).toEqual({ bridgeId: "bridge", items: [{ id: "item" }] });
    expect(bridge.eq).toHaveBeenCalledWith("user_id", "user");
  });
  it("does not reuse another ad, an unverifiable upload analysis, or failed reads", async () => {
    for (const setup of [client("other-ad"), client("upload-hash"), client(undefined, { message: "denied" })]) {
      expect(await fetchReviewSkillGap(setup.supabase, { skills_bridge_id: "bridge", job_description: "the ad" }, "user")).toBeNull();
      expect(setup.from).toHaveBeenCalledTimes(1);
    }
  });
  it("does not query Skill Gap for a general resume", async () => {
    const { supabase, from } = client();
    expect(await fetchReviewSkillGap(supabase, { skills_bridge_id: "bridge", job_description: "" }, "user")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
