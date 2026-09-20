import { describe, expect, it } from "vitest";
import { isThinResume } from "@/lib/coverLetter/server";
import type { ResumeContent } from "@/types";

const base = { experience: [], education: [], skills: [] } as unknown as ResumeContent;

describe("isThinResume", () => {
  it("is thin with no content or only a couple of skills", () => {
    expect(isThinResume(null, 3)).toBe(true);
    expect(isThinResume({ ...base, skills: ["a", "b"] }, 3)).toBe(true);
  });

  it("is not thin with enough skills, experience or education", () => {
    expect(isThinResume({ ...base, skills: ["a", "b", "c"] }, 3)).toBe(false);
    expect(isThinResume({ ...base, experience: [{}] } as unknown as ResumeContent, 3)).toBe(false);
    expect(isThinResume({ ...base, education: [{}] } as unknown as ResumeContent, 3)).toBe(false);
  });
});
