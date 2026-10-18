import { describe, expect, it } from "vitest";
import { findTrackedJob, practiceJobKey, sessionJob, uploadedResumeName } from "./uploadedResume";

describe("uploadedResumeName", () => {
  it("uses the file name without its extension", () => {
    expect(uploadedResumeName("Jane_Smith_Resume_2026.pdf", { work_experience: [] })).toBe("Jane Smith Resume 2026");
  });

  it("falls back to the latest role, then a plain name", () => {
    expect(uploadedResumeName(null, { work_experience: [{ job_title: "Analyst" } as never] })).toBe("Resume · Analyst");
    expect(uploadedResumeName(null, { work_experience: [] })).toBe("Pasted resume");
  });

  it("keeps names within 80 characters", () => {
    expect(uploadedResumeName(`${"a".repeat(120)}.docx`, { work_experience: [] })).toHaveLength(80);
  });
});

describe("sessionJob", () => {
  it("reads an uploaded-resume session's own copy of the job", () => {
    expect(
      sessionJob({ resume_id: null, job_title: "Analyst", company_name: "Acme", job_description: "The ad", resumes: null })
    ).toEqual({ jobTitle: "Analyst", companyName: "Acme", jobDescription: "The ad" });
  });

  it("reads a tailored session's job from its resume", () => {
    expect(
      sessionJob({ resume_id: "r1", resumes: { job_title: "Engineer", company_name: "Beta", job_description: "JD" } })
    ).toEqual({ jobTitle: "Engineer", companyName: "Beta", jobDescription: "JD" });
  });

  it("doesn't need job_description selected to name an uploaded session", () => {
    expect(sessionJob({ resume_id: null, job_title: "Analyst", company_name: "Acme" })).toEqual({
      jobTitle: "Analyst",
      companyName: "Acme",
      jobDescription: "",
    });
  });

  it("copes with a tailored session without a joined resume", () => {
    expect(sessionJob({ resume_id: "r1" })).toEqual({
      jobTitle: null,
      companyName: null,
      jobDescription: "",
    });
  });
});

describe("practiceJobKey", () => {
  it("is the tailored resume id", () => {
    expect(practiceJobKey({ resume_id: "r1", uploaded_resume_id: null, job_title: null, company_name: null })).toBe("r1");
  });

  it("groups uploaded practice by resume, title and company, ignoring case", () => {
    const a = practiceJobKey({ resume_id: null, uploaded_resume_id: "u1", job_title: "Analyst", company_name: "Acme" });
    const b = practiceJobKey({ resume_id: null, uploaded_resume_id: "u1", job_title: "analyst", company_name: "ACME" });
    const other = practiceJobKey({ resume_id: null, uploaded_resume_id: "u1", job_title: "Analyst", company_name: "Beta" });
    expect(a).toBe(b);
    expect(a).not.toBe(other);
  });
});

describe("findTrackedJob", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  const apps = [
    { id: "a1", company_name: "Acme Pty Ltd", job_title: "Data Analyst - Melbourne" },
    { id: "a2", company_name: "Acme", job_title: "Data Analyst" },
    { id: "a3", company_name: "Beta", job_title: "Data Analyst" },
  ];

  it("matches the same company and a matching title, ignoring case and legal suffixes", () => {
    const match = findTrackedJob([apps[0]], [], "data analyst", "ACME", now);
    expect(match?.application.id).toBe("a1");
    expect(match?.nextInterview).toBeNull();
  });

  it("prefers an exact title over a longer form of it", () => {
    expect(findTrackedJob(apps, [], "Data Analyst", "Acme", now)?.application.id).toBe("a2");
  });

  it("prefers the application with an interview coming up, and returns that interview", () => {
    const interviews: Parameters<typeof findTrackedJob>[1] = [
      { id: "i-past", application_id: "a1", outcome: "scheduled", scheduled_at: "2026-10-01T00:00:00Z" },
      { id: "i-next", application_id: "a2", outcome: "scheduled", scheduled_at: "2026-10-20T00:00:00Z" },
    ];
    const match = findTrackedJob(apps, interviews, "Data Analyst", "Acme", now);
    expect(match?.application.id).toBe("a2");
    expect(match?.nextInterview?.id).toBe("i-next");
  });

  it("finds nothing for another company or a different role", () => {
    expect(findTrackedJob(apps, [], "Data Analyst", "Gamma", now)).toBeNull();
    expect(findTrackedJob(apps, [], "Chef", "Acme", now)).toBeNull();
    expect(findTrackedJob(apps, [], "Data Analyst", "", now)).toBeNull();
  });
});
