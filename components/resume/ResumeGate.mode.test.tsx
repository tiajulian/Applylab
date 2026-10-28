// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const getUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  }),
}));

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

// A tiny fixed dictionary instead of fetching the real en-AU files, so the pre-generate text check
// is deterministic and makes no network calls.
vi.mock("@/lib/text/spellcheck", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/text/spellcheck")>();
  const { default: nspell } = await import("nspell");
  const words = ["coordinated", "dispatch", "excel", "reporting", "scheduling"];
  const checker = nspell("SET UTF-8\n", `${words.length}\n${words.join("\n")}`);
  return { ...actual, getSpellChecker: async () => checker };
});

// The invisible captcha passes straight away, so the upload path doesn't wait on Cloudflare.
vi.mock("@/components/ui/TurnstileWidget", async () => {
  const { useEffect } = await import("react");
  return {
    TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => {
      useEffect(() => onVerify("test-token"), [onVerify]);
      return null;
    },
  };
});

const { ResumeGate } = await import("./ResumeGate");
const { AccountGateProvider } = await import("@/components/auth/AccountGate");

// framer-motion's viewport features (Reveal, ProfileCompleteness) need IntersectionObserver,
// which jsdom does not implement.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Meets getMissingMvpFields, so the gate renders the creation area with no gap-fill form.
const completeProfile = {
  fullName: "Sam Lee",
  work_rights: "Australian citizen",
  location: "Parramatta, NSW",
  skills: ["Excel", "Reporting", "Scheduling"],
  work_experience: [
    {
      job_title: "Coordinator",
      company: "Acme",
      location: "Sydney",
      start_date: "Jan 2020",
      end_date: "Present",
      is_current: true,
      description: "Coordinated dispatch",
      wins: [],
    },
  ],
};

function renderGate(props: { remaining?: number | null; isPaidPlan?: boolean; description?: string } = {}) {
  const [role] = completeProfile.work_experience;
  return render(
    <ResumeGate
      initial={
        props.description === undefined
          ? completeProfile
          : { ...completeProfile, work_experience: [{ ...role, description: props.description }] }
      }
      isPaidPlan={props.isPaidPlan ?? false}
      remaining={props.remaining === undefined ? 2 : props.remaining}
      limit={2}
    />
  );
}

describe("ResumeGate start-mode choice", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    getUser.mockResolvedValue({ data: { user: { is_anonymous: false } } });
    push.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows both ways to start inline, with the job-ad form chosen by default", () => {
    renderGate();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /for a job ad/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /general resume/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText(/job ad/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see how i match this job/i })).toBeInTheDocument();
  });

  it("switches to the general form and back again", () => {
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
    expect(screen.queryByLabelText(/job ad/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build my resume/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /for a job ad/i }));
    expect(screen.getByLabelText(/job ad/i)).toBeInTheDocument();
  });

  it("matches a job ad against the profile by default, with a file one link away", () => {
    renderGate();

    expect(screen.getByText(/matching against your profile/i)).toBeInTheDocument();
    const matchButton = screen.getByRole("button", { name: /see how i match this job/i });
    expect(matchButton).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /use a resume file instead/i }));
    expect(screen.queryByText(/matching against your profile/i)).not.toBeInTheDocument();
    // No file chosen yet, so there's nothing to match.
    expect(matchButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /use my profile instead/i }));
    expect(screen.getByText(/matching against your profile/i)).toBeInTheDocument();
    expect(matchButton).toBeEnabled();
  });

  it("checks the fit against an uploaded file, with the title read from the ad", async () => {
    const parsed = {
      fullName: "Sam Lee",
      skills: ["Forklift"],
      work_experience: [{ job_title: "Storeperson", company: "Depot Co" }],
      education: [],
      projects: [],
      referees: [],
    };
    vi.mocked(fetch).mockImplementation(async (url) => {
      const json =
        url === "/api/parse-job-ad"
          ? { title: "Warehouse Lead", company: "Acme" }
          : url === "/api/profile/parse"
            ? { profile: parsed }
            : { bridge: { id: "bridge-1", mode: "direct" }, items: [], roles: [], projects: [] };
      return { ok: true, json: async () => json } as Response;
    });
    const { container } = renderGate();

    fireEvent.change(screen.getByLabelText(/job ad/i), { target: { value: "Warehouse Lead at Acme. Lead a team of pickers." } });
    fireEvent.click(screen.getByRole("button", { name: /use a resume file instead/i }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "resume.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: /see how i match this job/i }));

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/skills-bridge")).toBe(true));
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => url);
    // The title read starts before the file parse, so an autofill finishing mid-parse can't be missed.
    expect(urls.indexOf("/api/parse-job-ad")).toBeLessThan(urls.indexOf("/api/profile/parse"));
    const [, init] = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/skills-bridge")!;
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      jobTitle: "Warehouse Lead",
      companyName: "Acme",
      source: "upload",
      importedProfile: parsed,
      turnstileToken: "test-token",
    });
  });

  it("generates a general resume without a job ad and opens it", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ resume: { id: "res-1" } }),
    } as Response);
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/resume/res-1?fromGeneration=1"));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/generate-resume");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ mode: "general" });
  });

  it("swaps the build button for a Go Pro link when the free quota is spent", () => {
    renderGate({ remaining: 0 });

    fireEvent.click(screen.getByRole("button", { name: /general resume/i }));

    expect(screen.queryByRole("button", { name: /build my resume/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go pro/i })).toHaveAttribute("href", "/upgrade");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("asks a guest to create a free account instead of generating", async () => {
    getUser.mockResolvedValue({ data: { user: { is_anonymous: true, user_metadata: {} } } });
    const [role] = completeProfile.work_experience;
    render(
      <AccountGateProvider initialIsGuest>
        <ResumeGate initial={{ ...completeProfile, work_experience: [role] }} isPaidPlan={false} remaining={2} limit={2} />
      </AccountGateProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(/create your free account to make your resume/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("what a general resume starts from", () => {
    function jsonResponse(body: unknown) {
      return { ok: true, json: async () => body } as Response;
    }

    it("defaults to the profile when it's complete", () => {
      renderGate();
      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));

      expect(screen.getByRole("radio", { name: /my profile/i })).toBeChecked();
    });

    it("defaults to upload, without the profile gap form, when the profile is incomplete", () => {
      render(<ResumeGate initial={{ fullName: "Sam Lee" }} isPaidPlan={false} remaining={2} limit={2} />);
      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));

      expect(screen.getByRole("radio", { name: /upload a resume/i })).toBeChecked();
      expect(screen.queryByText(/a few details for your profile/i)).not.toBeInTheDocument();

      // Back to the profile source: the gap form returns.
      fireEvent.click(screen.getByRole("radio", { name: /my profile/i }));
      expect(screen.getByText(/a few details for your profile/i)).toBeInTheDocument();
    });

    it("reads an uploaded file, then writes the resume from it", async () => {
      const parsed = { fullName: "Sam Lee", skills: ["Excel"] };
      vi.mocked(fetch)
        .mockResolvedValueOnce(jsonResponse({ profile: parsed }))
        .mockResolvedValueOnce(jsonResponse({ resume: { id: "res-up" } }));
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("radio", { name: /upload a resume/i }));
      const build = screen.getByRole("button", { name: /build from my resume/i });
      expect(build).toBeDisabled();

      const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
      fireEvent.change(screen.getByLabelText(/drop your resume here/i), { target: { files: [file] } });
      expect(screen.getByText("resume.pdf")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /build from my resume/i }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/resume/res-up?fromGeneration=1"));
      const [[parseUrl, parseInit], [genUrl, genInit]] = vi.mocked(fetch).mock.calls;
      expect(parseUrl).toBe("/api/profile/parse");
      expect((parseInit?.body as FormData).get("turnstileToken")).toBe("test-token");
      expect(genUrl).toBe("/api/generate-resume");
      expect(JSON.parse(genInit?.body as string)).toEqual({ mode: "general", source: "upload", importedProfile: parsed });
    });

    it("stops before generating when the file has nothing to write from", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ profile: { fullName: "Sam Lee", phone: "0400" } }));
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("radio", { name: /upload a resume/i }));
      const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" });
      fireEvent.change(screen.getByLabelText(/drop your resume here/i), { target: { files: [file] } });
      fireEvent.click(screen.getByRole("button", { name: /build from my resume/i }));

      expect(await screen.findByText(/couldn't find any experience/i)).toBeInTheDocument();
      // Only the parse ran: no generation was spent on it.
      expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(["/api/profile/parse"]);

      // Trying the same file again doesn't read it again either.
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      await waitFor(() => expect(screen.getByRole("button", { name: /try again/i })).not.toBeDisabled());
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("says the request may have timed out when the server returns a non-JSON page", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      } as unknown as Response);
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

      expect(await screen.findByText(/may have timed out/i)).toBeInTheDocument();
    });

    it("turns away an unsupported file before uploading it", () => {
      renderGate();
      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("radio", { name: /upload a resume/i }));

      const file = new File(["x"], "resume.png", { type: "image/png" });
      fireEvent.change(screen.getByLabelText(/drop your resume here/i), { target: { files: [file] } });

      expect(screen.getByText(/file type isn't supported/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /build from my resume/i })).toBeDisabled();
    });

    it("opens a blank resume from scratch with the fill-it-in hint", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ resume: { id: "res-blank" } }));
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("radio", { name: /start from scratch/i }));
      fireEvent.click(screen.getByRole("button", { name: /open a blank resume/i }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/resume/res-blank?blank=1"));
      expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/resumes");
    });
  });

  describe("spelling and grammar check before generating", () => {
    it("warns about a typo in the profile text, and only generates after Continue anyway", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ resume: { id: "res-2" } }) } as Response);
      renderGate({ description: "Coordinated dispatchh" });

      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("dispatchh");
      expect(dialog).toHaveTextContent("Coordinator at Acme");
      expect(fetch).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /continue anyway/i }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/resume/res-2?fromGeneration=1"));
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("stays on the form without generating when the user goes back", async () => {
      renderGate({ description: "Coordinated dispatchh" });

      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));
      await screen.findByRole("dialog");

      fireEvent.click(screen.getByRole("button", { name: /go back/i }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(fetch).not.toHaveBeenCalled();
      // Back to a usable form: not stuck in a loading state.
      expect(screen.getByRole("button", { name: /build my resume/i })).not.toBeDisabled();
    });

    it("does not interrupt when the text is clean", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ resume: { id: "res-3" } }) } as Response);
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: /general resume/i }));
      fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/resume/res-3?fromGeneration=1"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
