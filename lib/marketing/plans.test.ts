import { describe, it, expect } from "vitest";
import { FREE_RESUME_LIMIT } from "@/lib/limits";
import { PLANS } from "./plans";

describe("PLANS", () => {
  it("states the real free resume limit, so marketing can't drift from the code", () => {
    expect(PLANS.free.features[0]).toContain(String(FREE_RESUME_LIMIT));
  });

  it("names the paid plan Pro", () => {
    expect(PLANS.pro.name).toBe("Pro");
  });
});
