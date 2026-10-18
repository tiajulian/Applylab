import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    UnauthorizedError,
    requireUser: vi.fn(),
    /** What each lookup returns, by which filter it used: "url" (job_url) or "job" (title+company). */
    lookups: { url: null as unknown, job: null as unknown },
    inserted: vi.fn(),
  };
});

vi.mock("@/lib/requireUser", () => ({ requireUser: mocks.requireUser, UnauthorizedError: mocks.UnauthorizedError }));
vi.mock("@/lib/extensionCors", () => ({
  extensionCorsPreflight: vi.fn(),
  withExtensionCors: (response: Response) => response,
}));

/** A chainable stand-in for supabase.from("applications"): records the filters, then resolves. */
function applicationsTable() {
  const filters: string[] = [];
  const chain = {
    select: () => chain,
    eq: (column: string) => {
      filters.push(column);
      return chain;
    },
    ilike: () => {
      filters.push("ilike");
      return chain;
    },
    gte: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: filters.includes("job_url") ? mocks.lookups.url : mocks.lookups.job, error: null }),
    insert: (row: Record<string, unknown>) => {
      mocks.inserted(row);
      return { select: () => ({ single: async () => ({ data: { id: "new-app", ...row }, error: null }) }) };
    },
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: () => applicationsTable() }) }));

const { POST } = await import("./route");

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const DAYFORCE_APPLY = "https://jobs.dayforcehcm.com/en-AU/avant/CANDIDATEPORTAL/jobs/12345/apply/manualApplication";

describe("POST /api/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ authUserId: "user-1" });
    mocks.lookups.url = null;
    mocks.lookups.job = null;
  });

  it("never saves the extension's placeholders; asks for the details instead", async () => {
    const res = await post({
      source: "extension",
      job_title: "Manual application | Dayforce Jobs",
      page_title: "Manual application | Dayforce Jobs",
      company_name: "Company",
      job_url: DAYFORCE_APPLY,
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.needs_details).toBe(true);
    // The employer comes from the Dayforce tenant; only the title is missing.
    expect(body.suggested).toEqual({ job_title: "", company_name: "Avant" });
    expect(mocks.inserted).not.toHaveBeenCalled();
  });

  it("saves a confirmed extension job with the ad's link and its source", async () => {
    const res = await post({
      source: "extension",
      confirmed: true,
      job_title: "Claims Officer",
      company_name: "",
      job_url: DAYFORCE_APPLY,
    });
    expect(res.status).toBe(200);
    expect(mocks.inserted).toHaveBeenCalledWith(
      expect.objectContaining({
        job_title: "Claims Officer",
        company_name: "Avant",
        job_url: "https://jobs.dayforcehcm.com/en-AU/avant/CANDIDATEPORTAL/jobs/12345",
        notes: null,
        source: "extension",
        source_site: "Dayforce",
      })
    );
  });

  it("returns the existing application when the extension saves the same job again", async () => {
    mocks.lookups.job = { id: "app-1", job_title: "Claims Officer", company_name: "Avant", resume_id: null };
    const res = await post({ source: "extension", job_title: "Claims Officer", company_name: "avant" });
    expect(await res.json()).toMatchObject({ existing: true, application: { id: "app-1" } });
    expect(mocks.inserted).not.toHaveBeenCalled();
  });

  it("lets a deliberate in-app add of the same title and company through", async () => {
    mocks.lookups.job = { id: "app-1", job_title: "Claims Officer", company_name: "Avant", resume_id: null };
    await post({ job_title: "Claims Officer", company_name: "Avant", status: "interviewing" });
    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ status: "interviewing" }));
  });

  it("keeps two ads with the same title and company but different links apart", async () => {
    mocks.lookups.job = { id: "app-1", job_title: "Graduate Analyst", company_name: "Deloitte", job_url: "https://jobs.example.com/mel" };
    await post({ source: "extension", job_title: "Graduate Analyst", company_name: "Deloitte", job_url: "https://jobs.example.com/syd" });
    expect(mocks.inserted).toHaveBeenCalled();
  });

  it("treats an old extension build (no source, legacy note) as the extension", async () => {
    await post({
      job_title: "Claims Officer",
      company_name: "Workday Employer",
      job_url: "https://acme.wd3.myworkdayjobs.com/en-US/External/job/123",
      notes: "Logged via ApplyLab Co-Pilot on Workday",
    });
    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ company_name: "Acme", notes: null, source: "extension" }));
  });

  it("rejects a typed 'Company' from the in-app form", async () => {
    const res = await post({ job_title: "Analyst", company_name: "Company" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Add the company before saving.");
  });
});
