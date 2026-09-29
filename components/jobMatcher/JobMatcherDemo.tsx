"use client";

// Dev-only preview of Job Matcher on sample data (app/dev/job-matcher). Intercepts the page's
// /api calls in the browser so every state can be viewed without an account or live data:
// ?state=quickstart (nothing to match on), ?state=custom (customised search), ?state=empty.
import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { JobMatcher } from "@/components/jobMatcher/JobMatcher";
import type { JobDto, MatchItem } from "@/lib/jobs/client";
import { EMPTY_PROFILE } from "@/lib/jobs/profile";

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

function job(id: string, overrides: Partial<JobDto>): JobDto {
  return {
    id,
    title: "",
    company: null,
    location: "Sydney CBD, Sydney",
    salaryMin: null,
    salaryMax: null,
    salaryIsPredicted: false,
    contractType: null,
    contractTime: null,
    snippet: "",
    postedAt: ago(5),
    applyUrl: "https://www.adzuna.com.au",
    source: "adzuna",
    ...overrides,
  };
}

const MATCHES: MatchItem[] = [
  {
    job: job("1", {
      title: "Customer Service Officer",
      company: "Service NSW",
      location: "Kogarah, Sydney",
      salaryMin: 78_000,
      salaryMax: 86_000,
      contractTime: "full_time",
      snippet: "Help customers in person and over the phone with licences, registrations and concessions. Clear communicator, calm under pressure.",
      postedAt: ago(3),
    }),
    score: 69,
    reasons: ["Title matches Customer Service Officer", "Mentions Customer service", "Salary $78k–$86k", "Posted today"],
    saved: false,
  },
  {
    job: job("2", {
      title: "Data Analyst, Financial Crime",
      company: "Commonwealth Bank",
      location: "Sydney CBD, Sydney",
      salaryMin: 105_000,
      salaryMax: 125_000,
      salaryIsPredicted: true,
      contractTime: "full_time",
      contractType: "permanent",
      snippet: "Analyse transaction data with SQL and Python to detect suspicious matters and support AUSTRAC reporting.",
      postedAt: ago(26),
    }),
    score: 62,
    reasons: ["Mentions SQL, Python, Excel", "Estimated salary $105k–$125k", "Posted yesterday"],
    saved: true,
  },
  {
    job: job("3", {
      title: "Analytics Engineer",
      company: "Canva",
      location: "Surry Hills, Sydney",
      contractType: "permanent",
      snippet: "Build and maintain dbt models and dashboards that help product teams make decisions. Strong SQL essential.",
      postedAt: ago(52),
    }),
    score: 66,
    reasons: ["Title matches Analytics Engineer", "Mentions SQL, Tableau", "Posted 2 days ago"],
    saved: false,
  },
  {
    job: job("4", {
      title: "Customer Experience Specialist",
      company: "Qantas",
      location: "Mascot, Sydney",
      salaryMin: 70_000,
      salaryMax: 70_000,
      contractTime: "part_time",
      snippet: "Support customers across chat and phone, resolving bookings and feedback with care.",
      postedAt: ago(98),
    }),
    score: 47,
    reasons: ["Salary $70k", "Posted 4 days ago", "Similar to your profile"],
    saved: false,
  },
];

const PROFILE = {
  targetTitles: ["Customer Service Officer", "Data Analyst", "Analytics Engineer"],
  locations: ["Kogarah"],
  radiusKm: 50,
  skillCount: 8,
  isAuto: true,
};

const FULL_PROFILE = {
  ...EMPTY_PROFILE,
  targetTitles: PROFILE.targetTitles,
  skills: ["SQL", "Python", "Excel", "Tableau", "Customer service", "Stakeholder management", "Power BI", "Data analysis"],
  locations: ["Kogarah"],
  resumeText: "Analytics engineer at ABC. Extracted and analysed large datasets using SQL and Python.",
};

/** Serves the page's /api calls from sample data; returns a function that restores real fetch. */
function mockApi(state: string | null): () => void {
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  const realFetch = window.fetch;
  window.fetch = (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input), window.location.origin);
    const method = init?.method ?? "GET";
    if (url.pathname === "/api/job-matches") {
      if (state === "quickstart") return json({ hasProfile: false, profile: null, matches: [], total: 0, page: 1, limit: 20 });
      const matches = state === "empty" ? [] : MATCHES;
      const profile = state === "custom" ? { ...PROFILE, isAuto: false, locations: ["Kogarah", "Melbourne"], radiusKm: 25 } : PROFILE;
      return json({ hasProfile: true, profile, matches, total: state === "empty" ? 0 : 45, page: 1, limit: 20 });
    }
    if (url.pathname === "/api/job-profile") {
      return method === "GET" ? json({ profile: FULL_PROFILE, exists: true, isAuto: true }) : json({ profile: FULL_PROFILE, matchCount: 4, ok: true });
    }
    if (url.pathname === "/api/jobs/saved") {
      return json({ jobs: MATCHES.filter((m) => m.saved).map((m) => ({ job: m.job, isActive: true, savedAt: ago(2) })) });
    }
    if (url.pathname.startsWith("/api/jobs/")) return json({ ok: true });
    return realFetch(input, init);
  };
  return () => {
    window.fetch = realFetch;
  };
}

export function JobMatcherDemo() {
  // Mock only while this page is mounted, and render Job Matcher only once the mock is in place,
  // so its first requests hit sample data and navigating away restores the real fetch.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = mockApi(new URLSearchParams(window.location.search).get("state"));
    setReady(true);
    return restore;
  }, []);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-paper px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div>
            <h1 className="font-display text-h2 text-ink">Job Matcher</h1>
            <p className="mt-2 text-[15px] text-ink-secondary">Find roles that match your experience and preferences.</p>
            <p className="mt-1 text-xs text-ink-muted">Fresh Australian jobs, added every morning</p>
          </div>
          {ready && <JobMatcher />}
        </div>
      </div>
    </ToastProvider>
  );
}
