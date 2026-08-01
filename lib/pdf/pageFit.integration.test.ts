import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "puppeteer-core";
import { renderResumeToFittedPdf } from "./pageFit";
import "@/lib/pdf/domPolyfills";
import { PDFParse } from "pdf-parse";
import type { ResumeContent } from "@/types";

// Real Puppeteer + pdf-parse end-to-end checks for the one-page fit guarantee (Phase 3 of the
// one-page resume task). These are deliberately built from hand-authored ResumeContent fixtures
// rather than live Claude calls, so the suite stays deterministic, free, and runnable offline/CI.
// What this verifies: the fit ladder actually lands the rendered PDF on the target page count,
// and generated prose (the summary) stays free of em/en dashes. What it does NOT verify: visual
// fidelity to the target layout (alignment, rule placement, italics) - pdf-parse only gives text,
// so that needs a human looking at a real rendered PDF.
//
// Em/en dashes ARE expected elsewhere in the rendered text now: the templates deliberately use an
// em dash for date ranges and the company/location separator (an explicit, approved exception to
// the site-wide no-em/en-dash rule - see lib/resume/formatDateRange.ts). That's static template
// formatting, not generated content, so it doesn't go through lib/text/sanitizeDashes.ts and isn't
// what these tests are checking for. The summary field has no legitimate reason to contain one.

let browser: Browser;

beforeAll(async () => {
  const puppeteer = await import("puppeteer");
  browser = (await puppeteer.launch({ headless: true })) as unknown as Browser;
}, 30_000);

afterAll(async () => {
  await browser.close();
});

async function pdfPageCountAndText(pdf: Buffer): Promise<{ pages: number; text: string }> {
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getText();
    // Collapse line wraps/whitespace so text assertions aren't sensitive to where a PDF viewer
    // happened to wrap a line.
    return { pages: result.total, text: result.text.replace(/\s+/g, " ") };
  } finally {
    await parser.destroy();
  }
}

function role(overrides: Partial<ResumeContent["experience"][number]>): ResumeContent["experience"][number] {
  return {
    job_title: "",
    company: "",
    company_description: "",
    location: "Sydney, NSW",
    start_date: "",
    end_date: "",
    bullets: [],
    ...overrides,
  };
}

// Shaped from the real Tia Julian analytics-engineer profile (5 roles, pulled from this
// account's own user_profiles row), condensed to the one-page content budget: no per-company
// blurbs, skills grouped into labelled categories, recency-weighted bullet counts. The ABC role
// has no real bullet notes on file yet (current role, freshly started), so its bullets here are
// representative placeholders for fit-testing purposes, not a claim about her actual output.
const TIA_JULIAN_RESUME: ResumeContent = {
  contact: {
    name: "Tia Julian",
    phone: "0400 000 000",
    email: "tiajulian99@gmail.com",
    location: "Kogarah, NSW",
    linkedin: "linkedin.com/in/tia-julian-861a86182",
    work_rights: "Permanent Resident",
  },
  target_titles: ["Analytics Engineer", "Data Engineer", "BI Engineer"],
  summary:
    "Analytics Engineer with experience building dbt models, SQL pipelines and Tableau dashboards that turn raw data into decisions. Skilled in Snowflake, Python and computer vision, with a background spanning analytics engineering, ML engineering and BI reporting.",
  skills: [
    "Data modelling",
    "SQL query optimisation",
    "Dashboard development",
    "Stakeholder reporting",
    "ETL pipeline design",
    "Data validation",
    "Cross-team collaboration",
    "Technical documentation",
  ],
  tools: [
    "Data analysis and querying: SQL, Snowflake, Microsoft SQL Server",
    "Data visualisation and BI: Tableau, PushMetrics",
    "Data transformation: dbt, Fivetran",
    "Programming: Python",
    "Machine learning and AI: Computer Vision, Machine Learning",
  ],
  projects: [],
  experience: [
    role({
      job_title: "Analytics Engineer",
      company: "Australian Broadcasting Corporation (ABC)",
      start_date: "June 2026",
      end_date: "Present",
      bullets: [
        "Build and maintain dbt data models powering analytics and reporting across the organisation.",
        "Write SQL queries in Snowflake to support ad-hoc analysis and self-serve reporting.",
        "Partner with product and content teams to define metrics for audience engagement dashboards.",
        "Design Tableau dashboards used by editorial and commercial stakeholders to track KPIs.",
        "Document data models and transformation logic to improve team-wide data literacy.",
        "Automate recurring report delivery to reduce manual reporting effort.",
      ],
    }),
    role({
      job_title: "Data Analyst",
      company: "Brighte",
      start_date: "December 2024",
      end_date: "June 2026",
      bullets: [
        "Built and maintained Tableau dashboards visualising KPIs and business performance for stakeholders.",
        "Wrote complex SQL queries in Snowflake for one-off analysis and reporting.",
        "Designed and maintained dbt models across staging, preparation, base, mart and reporting layers.",
        "Automated report distribution through PushMetrics for timely stakeholder delivery.",
        "Supported migration of data ingestion pipelines from Stitch to Fivetran, updating dbt models accordingly.",
      ],
    }),
    role({
      job_title: "Associate Computer Vision & ML Engineer",
      company: "Lumachain",
      start_date: "June 2022",
      end_date: "October 2024",
      bullets: [
        "Collected and evaluated multi-modal data for computer vision AI projects.",
        "Tuned AI algorithm configurations for image recognition and object detection tasks.",
        "Conducted performance evaluations of AI algorithms for semantic segmentation.",
      ],
    }),
    role({
      job_title: "Junior Data Analyst",
      company: "McGirr Technologies",
      start_date: "July 2021",
      end_date: "June 2022",
      bullets: [
        "Created customised reports using Microsoft SQL Server Reporting Services for clients.",
        "Wrote queries to retrieve data sets from an enterprise MS SQL Server database.",
      ],
    }),
    role({
      job_title: "Member",
      company: "Coles",
      start_date: "December 2018",
      end_date: "August 2021",
      bullets: ["Delivered customer service in a high-volume retail environment."],
    }),
  ],
  education: [
    { degree: "Data Analytics and Business Information System Management", institution: "University of Technology Sydney", year: "2020 - 2022", notes: "" },
    { degree: "Bachelor's degree, Information Technology", institution: "UTS Insearch", year: "2019 - 2020", notes: "" },
    { degree: "Diploma of Business", institution: "Greenwich College", year: "2018 - 2019", notes: "" },
  ],
  referees: [],
};

function longBullets(count: number, label: string): string[] {
  return Array.from(
    { length: count },
    (_, i) => `Improved ${label} process ${i + 1} through data-driven analysis and stakeholder collaboration.`
  );
}

// Fabricated 6-role fixture with deliberately oversized bullet counts and a long summary, to force
// the trim ladder through every rung: referee line, spacing, oldest-role bullets, summary, font,
// and the last-resort second-oldest bullet drop.
const LONG_FIXTURE_RESUME: ResumeContent = {
  contact: {
    name: "Jordan Alexander Whitfield-Nakamura",
    phone: "0400 111 222",
    email: "jordan.whitfield.nakamura@example.com",
    location: "Melbourne, VIC",
    linkedin: "linkedin.com/in/jordan-whitfield-nakamura",
    work_rights: "Australian citizen",
  },
  target_titles: ["Head of Analytics", "Director of Data", "Analytics Lead"],
  summary: Array.from(
    { length: 10 },
    (_, i) => `Delivered measurable improvements in analytics reporting and stakeholder engagement in project ${i + 1}.`
  ).join(" "),
  skills: [
    "Data strategy",
    "Team leadership",
    "Stakeholder reporting",
    "Roadmap planning",
    "Data governance",
    "Cross-functional collaboration",
  ],
  tools: [
    "Data analysis and querying: SQL, Python, R, Snowflake, BigQuery",
    "Data visualisation and BI: Tableau, Power BI, Looker",
    "Data transformation: dbt, Airflow, Fivetran",
    "Programming: Python, Java, Scala",
    "Cloud and tools: AWS, GCP, Docker, Terraform",
  ],
  projects: [],
  experience: [
    role({ job_title: "Head of Analytics", company: "Company One", start_date: "2023", end_date: "Present", bullets: longBullets(8, "analytics") }),
    role({ job_title: "Senior Data Analyst", company: "Company Two", start_date: "2021", end_date: "2023", bullets: longBullets(5, "reporting") }),
    role({ job_title: "Data Analyst", company: "Company Three", start_date: "2019", end_date: "2021", bullets: longBullets(3, "dashboard") }),
    role({ job_title: "Junior Data Analyst", company: "Company Four", start_date: "2017", end_date: "2019", bullets: longBullets(2, "process") }),
    role({ job_title: "Reporting Assistant", company: "Company Five", start_date: "2015", end_date: "2017", bullets: longBullets(2, "spreadsheet") }),
    role({ job_title: "Intern Analyst", company: "Company Six", start_date: "2014", end_date: "2015", bullets: longBullets(2, "support") }),
  ],
  education: [
    { degree: "Master of Data Science", institution: "University of Melbourne", year: "2013 - 2014", notes: "" },
    { degree: "Bachelor of Commerce", institution: "Monash University", year: "2010 - 2013", notes: "" },
  ],
  referees: [
    { name: "Alex Manager", title: "Director", organisation: "Company One", phone: "0400 000 000", email: "alex@example.com" },
    { name: "Sam Boss", title: "VP", organisation: "Company Two", phone: "0400 000 001", email: "sam@example.com" },
  ],
};

// Minimal 1-role fixture. The underflow guard means this should render at full default density
// with nothing trimmed, not be artificially padded to fill the page.
const SHORT_FIXTURE_RESUME: ResumeContent = {
  contact: {
    name: "Riley Chen",
    phone: "0400 333 444",
    email: "riley.chen@example.com",
    location: "Brisbane, QLD",
    linkedin: "linkedin.com/in/riley-chen",
    work_rights: "Australian citizen",
  },
  target_titles: ["Data Analyst"],
  summary: "Recent graduate data analyst with hands-on SQL and Python project experience, keen to grow into a full-time analytics role.",
  skills: ["SQL querying", "Dashboard building", "Data cleaning"],
  tools: [
    "Data analysis and querying: SQL, Python",
    "Data visualisation and BI: Excel, Power BI",
  ],
  projects: [],
  experience: [
    role({
      job_title: "Data Analyst Intern",
      company: "Startup Co",
      start_date: "2024",
      end_date: "Present",
      bullets: [
        "Built a weekly sales dashboard in Power BI used by the leadership team.",
        "Cleaned and validated customer datasets ahead of a CRM migration.",
        "Wrote SQL queries to support ad-hoc requests from the marketing team.",
      ],
    }),
  ],
  education: [{ degree: "Bachelor of Data Science", institution: "Queensland University of Technology", year: "2021 - 2024", notes: "" }],
  referees: [],
};

const DASH_REGEX = /[—–]/;

describe("renderResumeToFittedPdf", () => {
  it("fits the real (Tia Julian) profile fixture on exactly one page with no em/en dash anywhere", async () => {
    const pdf = await renderResumeToFittedPdf(browser, TIA_JULIAN_RESUME, "ats-safe");
    const { pages, text } = await pdfPageCountAndText(pdf);
    expect(pages).toBe(1);
    expect(text).not.toMatch(DASH_REGEX);
    expect(text).toContain("Tia Julian");
    expect(text).not.toContain("Referees available on request");
  }, 30_000);

  it("fits the real profile fixture on the design-forward template too", async () => {
    const pdf = await renderResumeToFittedPdf(browser, TIA_JULIAN_RESUME, "design-forward");
    const { pages, text } = await pdfPageCountAndText(pdf);
    expect(pages).toBe(1);
    expect(text).not.toMatch(DASH_REGEX);
  }, 30_000);

  it("trims a long (6-role) fixture down to one page via the fit ladder, not by overflowing", async () => {
    const pdf = await renderResumeToFittedPdf(browser, LONG_FIXTURE_RESUME, "ats-safe");
    const { pages, text } = await pdfPageCountAndText(pdf);
    expect(pages).toBe(1);
    expect(text).not.toMatch(DASH_REGEX);
    // The two most recent roles must survive with their 3-bullet floor intact.
    expect(text).toContain("Head of Analytics");
    expect(text).toContain("Senior Data Analyst");
  }, 30_000);

  it("keeps a short (1-role) fixture on one page without padding", async () => {
    const pdf = await renderResumeToFittedPdf(browser, SHORT_FIXTURE_RESUME, "ats-safe");
    const { pages, text } = await pdfPageCountAndText(pdf);
    expect(pages).toBe(1);
    expect(text).not.toMatch(DASH_REGEX);
    // Full summary should survive untrimmed (it's already well under the word bound).
    expect(text).toContain("keen to grow into a full-time analytics role");
  }, 30_000);

  it("accepts a two-page ceiling for a genuinely long career, rather than compressing to floor density chasing an impossible one page", async () => {
    // Deliberately far beyond what even floor density can fit on one page: 6 substantial roles
    // with realistic (not minimal) bullet counts. Proves the fit loop settles on the LEAST
    // aggressive state that reaches two pages, not the most aggressive one - and never spills to
    // a third page.
    const heavyRole = (title: string, company: string, start: string, end: string) =>
      role({
        job_title: title,
        company,
        start_date: start,
        end_date: end,
        bullets: Array.from(
          { length: 6 },
          (_, i) => `Delivered ${title.toLowerCase()} initiative ${i + 1} across multiple systems and stakeholder groups.`
        ),
      });

    const veryLongResume: ResumeContent = {
      ...LONG_FIXTURE_RESUME,
      experience: [
        heavyRole("Head of Analytics", "Company One", "2023", "Present"),
        heavyRole("Senior Data Analyst", "Company Two", "2021", "2023"),
        heavyRole("Data Analyst", "Company Three", "2019", "2021"),
        heavyRole("Junior Data Analyst", "Company Four", "2017", "2019"),
        heavyRole("Reporting Assistant", "Company Five", "2015", "2017"),
        heavyRole("Intern Analyst", "Company Six", "2014", "2015"),
      ],
    };

    const pdf = await renderResumeToFittedPdf(browser, veryLongResume, "ats-safe");
    const { pages, text } = await pdfPageCountAndText(pdf);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(2);
    expect(text).not.toMatch(DASH_REGEX);
    expect(text).toContain("Head of Analytics");
  }, 30_000);
});
