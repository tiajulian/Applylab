// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const getUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser } }),
}));

// A tiny fixed dictionary instead of fetching the real en-AU files, so the pre-generate text check
// is deterministic and makes no network calls.
vi.mock("@/lib/text/spellcheck", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/text/spellcheck")>();
  const { default: nspell } = await import("nspell");
  const words = ["coordinated", "dispatch", "excel", "reporting", "scheduling"];
  const checker = nspell("SET UTF-8\n", `${words.length}\n${words.join("\n")}`);
  return { ...actual, getSpellChecker: async () => checker };
});

const { ResumeGate } = await import("./ResumeGate");

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

  it("asks how to start before showing either form", () => {
    renderGate();

    expect(screen.getByRole("button", { name: /tailor to a job ad/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build a general resume/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/job ad/i)).not.toBeInTheDocument();
  });

  it("keeps the job-ad workflow behind the tailor option", () => {
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: /tailor to a job ad/i }));

    expect(screen.getByLabelText(/job ad/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see how i match this job/i })).toBeInTheDocument();
  });

  it("lets the user go back and change their choice", () => {
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: /build a general resume/i }));
    expect(screen.queryByLabelText(/job ad/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /change$/i }));
    expect(screen.getByRole("button", { name: /tailor to a job ad/i })).toBeInTheDocument();
  });

  it("generates a general resume without a job ad and opens it", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ resume: { id: "res-1" } }),
    } as Response);
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: /build a general resume/i }));
    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/resume/res-1?fromGeneration=1"));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/generate-resume");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ mode: "general", template: "clean" });
  });

  it("pops the limit modal instead of calling the API when the free quota is spent", async () => {
    renderGate({ remaining: 0 });

    fireEvent.click(screen.getByRole("button", { name: /build a general resume/i }));
    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("You've used your free resumes");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not generate for an anonymous user", async () => {
    getUser.mockResolvedValue({ data: { user: { is_anonymous: true, user_metadata: {} } } });
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: /build a general resume/i }));
    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    await waitFor(() => expect(getUser).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("spelling and grammar check before generating", () => {
    it("warns about a typo in the profile text, and only generates after Continue anyway", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ resume: { id: "res-2" } }) } as Response);
      renderGate({ description: "Coordinated dispatchh" });

      fireEvent.click(screen.getByRole("button", { name: /build a general resume/i }));
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

      fireEvent.click(screen.getByRole("button", { name: /build a general resume/i }));
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

      fireEvent.click(screen.getByRole("button", { name: /build a general resume/i }));
      fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

      await waitFor(() => expect(push).toHaveBeenCalledWith("/resume/res-3?fromGeneration=1"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
