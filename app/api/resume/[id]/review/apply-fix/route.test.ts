import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, UnauthorizedError, assertPaidPlan, PaidFeatureError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class PaidFeatureError extends Error {}
  return {
    requireUser: vi.fn(),
    UnauthorizedError,
    assertPaidPlan: vi.fn(),
    PaidFeatureError,
  };
});

vi.mock("@/lib/requireUser", () => ({
  requireUser,
  UnauthorizedError,
  assertPaidPlan,
  PaidFeatureError,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/resume/versions", () => ({
  saveVersionSnapshot: vi.fn().mockResolvedValue(true),
}));

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleResumeContent = {
  contact: { name: "Jane Doe", email: "jane@example.com", phone: "+61 400 123 456", location: "Sydney", linkedin: "", work_rights: "" },
  target_titles: ["Operations Lead"],
  summary: "Experienced leader.",
  skills: ["Leadership", "Operations"],
  tools: [],
  experience: [
    {
      job_title: "Manager",
      company: "Acme",
      company_description: "",
      location: "Sydney",
      start_date: "2022",
      end_date: "Present",
      bullets: ["Responsible for leading the team."],
    },
  ],
  projects: [],
  education: [],
  referees: [],
};

describe("POST /api/resume/[id]/review/apply-fix", () => {
  it("rejects non-paying free users with 403", async () => {
    requireUser.mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", plan: "free" },
    });
    assertPaidPlan.mockImplementationOnce(() => {
      throw new PaidFeatureError("Upgrade to Pro to apply fixes");
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/resume/res-1/review/apply-fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingId: "finding-1",
        fixText: "Led a team of 15 logistics coordinators.",
      }),
    });

    const res = await POST(req, { params: { id: "res-1" } });
    expect(res.status).toBe(403);
  });

  it("applies target bullet replacement and updates finding status to applied for Pro users", async () => {
    requireUser.mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", plan: "pro" },
    });
    assertPaidPlan.mockReturnValue(undefined);

    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: "res-1",
        user_id: "user-1",
        resume_content: sampleResumeContent,
        review_findings: [
          { id: "finding-1", title: "Passive voice", status: "open" },
        ],
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    vi.mocked(createClient).mockReturnValue({ from: mockSelect } as any);

    const updatedResumeRow = {
      id: "res-1",
      resume_content: {
        ...sampleResumeContent,
        experience: [
          {
            ...sampleResumeContent.experience[0],
            bullets: ["Led a high-performing team of 15 operations specialists."],
          },
        ],
      },
      review_findings: [
        { id: "finding-1", title: "Passive voice", status: "applied" },
      ],
    };

    const mockUpdateSingle = vi.fn().mockResolvedValueOnce({
      data: updatedResumeRow,
      error: null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: mockUpdateSingle,
        }),
      }),
    });

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    } as any);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/resume/res-1/review/apply-fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingId: "finding-1",
        fixText: "Led a high-performing team of 15 operations specialists.",
        target: { kind: "experienceBullet", index: 0, bulletIndex: 0 },
      }),
    });

    const res = await POST(req, { params: { id: "res-1" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.resume.resume_content.experience[0].bullets[0]).toBe(
      "Led a high-performing team of 15 operations specialists."
    );
    expect(json.findings[0].status).toBe("applied");
  });
});
