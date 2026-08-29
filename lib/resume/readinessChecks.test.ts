import { describe, it, expect } from "vitest";
import { checkApplicationReadiness, MAX_READINESS_POINTS } from "./readinessChecks";
import type { ResumeContent } from "@/types";

function createSampleResume(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    contact: {
      name: "Alex Taylor",
      email: "alex@example.com",
      phone: "+61 400 111 222",
      location: "Melbourne, VIC",
      linkedin: "https://linkedin.com/in/alextaylor",
      work_rights: "Australian Citizen",
    },
    target_titles: ["Software Engineer"],
    summary: "Full stack engineer delivering scalable web platforms.",
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    tools: ["Cloud: AWS, Docker, GitHub"],
    experience: [
      {
        job_title: "Senior Engineer",
        company: "TechCorp",
        company_description: "",
        location: "Melbourne",
        start_date: "2021",
        end_date: "Present",
        bullets: [
          "Architected microservices that handled 50k requests per second with 99.99% uptime.",
          "Mentored 6 junior engineers on code reviews and test automation best practices.",
        ],
      },
      {
        job_title: "Software Engineer",
        company: "StartupLab",
        company_description: "",
        location: "Melbourne",
        start_date: "2019",
        end_date: "2021",
        bullets: [
          "Developed core billing integration in Stripe processing $2M in annual recurring revenue.",
          "Automated deployment pipelines using GitHub Actions reducing release cycle to 15 minutes.",
        ],
      },
    ],
    projects: [],
    education: [
      {
        degree: "Bachelor of Computer Science",
        institution: "Monash University",
        year: "2019",
        notes: "",
      },
    ],
    referees: [
      {
        name: "Ref One",
        title: "Engineering Manager",
        organisation: "TechCorp",
        phone: "+61 400 111 000",
        email: "ref1@techcorp.com",
      },
      {
        name: "Ref Two",
        title: "CTO",
        organisation: "StartupLab",
        phone: "+61 400 222 000",
        email: "ref2@startuplab.com",
      },
    ],
    ...overrides,
  };
}

describe("checkApplicationReadiness", () => {
  it("gives full score for ready and concise resume", () => {
    const resume = createSampleResume();
    const result = checkApplicationReadiness(resume);

    expect(result.maxPoints).toBe(MAX_READINESS_POINTS);
    expect(result.score).toBe(MAX_READINESS_POINTS);
  });

  it("detects near duplicate bullets across different roles", () => {
    const resume = createSampleResume({
      experience: [
        {
          job_title: "Senior Engineer",
          company: "TechCorp",
          company_description: "",
          location: "Melbourne",
          start_date: "2021",
          end_date: "Present",
          bullets: [
            "Mentored junior engineers on code reviews and automated test best practices across the team.",
          ],
        },
        {
          job_title: "Engineer",
          company: "OldCorp",
          company_description: "",
          location: "Melbourne",
          start_date: "2019",
          end_date: "2021",
          bullets: [
            "Mentored junior engineers on code reviews and automated test best practices across the team.",
          ],
        },
      ],
    });

    const result = checkApplicationReadiness(resume);
    expect(result.findings.some((f) => f.id.includes("ready-duplicate-bullet"))).toBe(true);
    expect(result.score).toBeLessThan(MAX_READINESS_POINTS);
  });

  it("warns when no referees are provided", () => {
    const resume = createSampleResume({ referees: [] });
    const result = checkApplicationReadiness(resume);

    expect(result.findings.some((f) => f.id === "ready-referees-empty")).toBe(true);
  });
});
