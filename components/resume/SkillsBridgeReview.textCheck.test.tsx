// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SkillsBridge } from "@/types";

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const getUserMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/text/spellcheck", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/text/spellcheck")>();
  const { default: nspell } = await import("nspell");
  const words = ["coordinated", "dispatch", "we", "want", "a", "coordinator"];
  const checker = nspell("SET UTF-8\n", `${words.length}\n${words.join("\n")}`);
  return { ...actual, getSpellChecker: async () => checker };
});

const { SkillsBridgeReview } = await import("./SkillsBridgeReview");

const bridge: SkillsBridge = {
  id: "b1",
  user_id: "u1",
  job_title: "Business Analyst",
  company_name: "Acme",
  job_description_hash: "hash",
  mode: "level_up",
  created_at: new Date().toISOString(),
};

const cleanProfile = {
  sources: [{ label: "Coordinator at Acme", text: "Coordinated dispatch" }],
  knownWords: [],
};

function renderReview(jobDescription: string, profileCheck: typeof cleanProfile | null = cleanProfile) {
  return render(
    <SkillsBridgeReview
      bridge={bridge}
      initialItems={[]}
      roles={[]}
      jobTitle="Business Analyst"
      companyName="Acme"
      jobDescription={jobDescription}
      isPaidPlan={false}
      remaining={1}
      limit={2}
      profileCheck={profileCheck ?? undefined}
      onBack={() => {}}
    />
  );
}

describe("SkillsBridgeReview spelling and grammar check", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    pushMock.mockClear();
    getUserMock.mockReset().mockResolvedValue({ data: { user: { is_anonymous: false } } });
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ resume: { id: "r1" } }) } as Response);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("warns about a typo in the job ad before generating, and generates after Continue anyway", async () => {
    renderReview("We want a coordinater");

    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Job ad");
    expect(dialog).toHaveTextContent("coordinater");
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /continue anyway/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/resume/r1?fromGeneration=1"));
  });

  it("does not generate when the user goes back", async () => {
    renderReview("We want a coordinater");

    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /go back/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /build my resume/i })).not.toBeDisabled();
  });

  it("goes straight to generating when everything is clean", async () => {
    renderReview("We want a coordinator");

    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/resume/r1?fromGeneration=1"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("skips the check entirely when no profile text is supplied", async () => {
    renderReview("We want a coordinater", null);

    fireEvent.click(screen.getByRole("button", { name: /build my resume/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
