import { describe, expect, it } from "vitest";
import {
  cleanCompanyName,
  cleanJobTitle,
  companyFromAtsUrl,
  companyOrFallback,
  extensionOrigin,
  isPlaceholderTitle,
  jobAdUrl,
  siteNameFromUrl,
  userNotes,
} from "./jobListing";

const DAYFORCE_APPLY = "https://jobs.dayforcehcm.com/en-AU/avant/CANDIDATEPORTAL/jobs/12345/apply/manualApplication";

describe("placeholders", () => {
  it("never treats 'Company' or 'Manual application' as real", () => {
    expect(cleanCompanyName("Company")).toBe("");
    expect(cleanCompanyName("  unknown company ")).toBe("");
    expect(cleanCompanyName("Avant")).toBe("Avant");
    expect(cleanJobTitle("Manual application | Dayforce Jobs")).toBe("");
    expect(cleanJobTitle("Manual application")).toBe("");
    expect(cleanJobTitle("Data Analyst")).toBe("Data Analyst");
    // A platform that is part of the job stays.
    expect(cleanJobTitle("HRIS Analyst - Workday")).toBe("HRIS Analyst - Workday");
  });

  it("refuses the page <title> as the job title", () => {
    expect(isPlaceholderTitle("Senior Analyst | Dayforce Jobs", "Senior Analyst | Dayforce Jobs")).toBe(true);
    // Confirmed by the user (no page title passed): the site suffix is just trimmed.
    expect(cleanJobTitle("Senior Analyst | Dayforce Jobs")).toBe("Senior Analyst");
  });

  it("falls back to 'the company' in sentences", () => {
    expect(companyOrFallback("Company")).toBe("the company");
    expect(companyOrFallback("")).toBe("the company");
    expect(companyOrFallback("Avant")).toBe("Avant");
  });
});

describe("ATS links", () => {
  it("reads the employer from the tenant slug", () => {
    expect(companyFromAtsUrl(DAYFORCE_APPLY)).toBe("Avant");
    expect(companyFromAtsUrl("https://acme-health.wd3.myworkdayjobs.com/en-US/External/job/123")).toBe("Acme Health");
    expect(companyFromAtsUrl("https://boards.greenhouse.io/canva/jobs/1")).toBe("Canva");
    expect(companyFromAtsUrl("https://www.seek.com.au/job/1")).toBe("");
    expect(companyFromAtsUrl("https://wd3.myworkdaysite.com/en-US/recruiting/acme/External/job/123")).toBe("Acme");
    expect(companyFromAtsUrl("https://boards.greenhouse.io/embed/job_app?for=canva&token=1")).toBe("Canva");
  });

  it("stores the job ad, not the apply step", () => {
    expect(jobAdUrl(DAYFORCE_APPLY)).toBe("https://jobs.dayforcehcm.com/en-AU/avant/CANDIDATEPORTAL/jobs/12345");
    expect(jobAdUrl("https://jobs.lever.co/acme/abc/apply?lever-source=x")).toBe("https://jobs.lever.co/acme/abc");
    expect(jobAdUrl("https://www.seek.com.au/job/1?ref=x#y")).toBe("https://www.seek.com.au/job/1");
    // "/apply/" mid-path is part of the real link on PageUp.
    const pageUp = "https://secure.dc2.pageuppeople.com/apply/873/gateway/default.asp?sJobIDs=123";
    expect(jobAdUrl(pageUp)).toBe(pageUp);
    // Hash-routed career sites keep the route; a plain anchor goes.
    expect(jobAdUrl("https://careers.example.com/#/jobs/111")).toBe("https://careers.example.com#/jobs/111");
    // A job id in the query is kept, or two different jobs would look like one.
    expect(jobAdUrl("https://careers.example.com/job?jobId=42&utm_source=seek")).toBe("https://careers.example.com/job?jobId=42");
  });

  it("names the real site", () => {
    expect(siteNameFromUrl(DAYFORCE_APPLY)).toBe("Dayforce");
    expect(siteNameFromUrl("https://careers.example.com/x")).toBe("careers.example.com");
  });
});

describe("extension origin", () => {
  it("hides the legacy internal note and names the site", () => {
    const legacy = { notes: "Logged via ApplyLab Co-Pilot on Other", job_url: DAYFORCE_APPLY };
    expect(extensionOrigin(legacy)).toEqual({ site: "Dayforce" });
    expect(userNotes(legacy.notes)).toBe("");
    expect(extensionOrigin({ source: "extension", job_url: "https://www.seek.com.au/job/1" })).toEqual({ site: "SEEK" });
    expect(extensionOrigin({ notes: "Spoke to Jo", job_url: null })).toBeNull();
    expect(userNotes("Spoke to Jo")).toBe("Spoke to Jo");
  });
});
