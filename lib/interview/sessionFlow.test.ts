import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini/scoreInterviewAnswer", () => ({ scoreInterviewAnswer: vi.fn(), rewriteWithoutClaims: vi.fn() }));

import { loadAnswerEvidence, PracticeResumeDeletedError } from "./sessionFlow";

function client(rows: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const b: any = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () => ({ data: rows[table] ?? null });
      return b;
    },
  } as any;
}

describe("loadAnswerEvidence", () => {
  it("uses the Career Profile and tailored resume for tailored practice", async () => {
    const profile = { skills: ["SQL"] };
    const content = { summary: "Analyst" };
    const result = await loadAnswerEvidence(client({ user_profiles: profile }), "user-1", {
      resume_id: "r1",
      uploaded_resume_id: null,
      resumes: { resume_content: content as never },
    });
    expect(result).toEqual({ profile, resumeEvidence: content });
  });

  it("uses only the uploaded resume for Upload my resume practice", async () => {
    const parsed = { skills: ["Tableau"] };
    const result = await loadAnswerEvidence(
      client({ user_profiles: { skills: ["Never used"] }, uploaded_resumes: { raw_text: "Resume text", parsed } }),
      "user-1",
      { resume_id: null, uploaded_resume_id: "u1" }
    );
    expect(result).toEqual({ profile: parsed, resumeEvidence: "Resume text" });
  });

  it("refuses to score once the uploaded resume is deleted", async () => {
    await expect(loadAnswerEvidence(client({}), "user-1", { resume_id: null, uploaded_resume_id: null })).rejects.toBeInstanceOf(
      PracticeResumeDeletedError
    );
    await expect(loadAnswerEvidence(client({}), "user-1", { resume_id: null, uploaded_resume_id: "gone" })).rejects.toBeInstanceOf(
      PracticeResumeDeletedError
    );
  });
});
