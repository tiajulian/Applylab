import { describe, it, expect } from "vitest";
import { computePipelineCountsFromData } from "@/lib/dashboard/pipeline";

describe("pipeline counts computation", () => {
  it("calculates drafted resumes correctly", () => {
    const resumes = [{ id: "res-1" }, { id: "res-2" }, { id: "res-3" }];
    const applications = [
      {
        id: "app-1",
        resume_id: "res-1",
        status: "applied",
        company_name: "Acme",
        job_title: "Developer",
      },
    ];
    const interviews: any[] = [];

    const counts = computePipelineCountsFromData(resumes, applications, interviews);
    expect(counts.drafted).toBe(2);
    expect(counts.applied).toBe(1);
    expect(counts.screening).toBe(0);
    expect(counts.interview).toBe(0);
    expect(counts.offer).toBe(0);
    expect(counts.total).toBe(3);
  });

  it("differentiates screening vs interview based on stage type", () => {
    const resumes = [{ id: "res-1" }, { id: "res-2" }];
    const applications = [
      {
        id: "app-1",
        resume_id: "res-1",
        status: "interviewing",
        company_name: "Co A",
        job_title: "Analyst",
      },
      {
        id: "app-2",
        resume_id: "res-2",
        status: "interviewing",
        company_name: "Co B",
        job_title: "Engineer",
      },
      {
        id: "app-3",
        resume_id: null,
        status: "interviewing",
        company_name: "Co C",
        job_title: "Designer",
      },
    ];

    const interviews = [
      {
        id: "int-1",
        application_id: "app-1",
        stage_type: "phone_screen" as const,
        scheduled_at: "2026-09-01T10:00:00Z",
        outcome: "scheduled",
      },
      {
        id: "int-2",
        application_id: "app-2",
        stage_type: "panel" as const,
        scheduled_at: "2026-09-02T10:00:00Z",
        outcome: "scheduled",
      },
      // app-3 has no interview rounds recorded -> defaults to screening
    ];

    const counts = computePipelineCountsFromData(resumes, applications, interviews);
    expect(counts.screening).toBe(2); // app-1 (phone) and app-3 (no rounds)
    expect(counts.interview).toBe(1); // app-2 (panel)
    expect(counts.total).toBe(3);
  });
});
