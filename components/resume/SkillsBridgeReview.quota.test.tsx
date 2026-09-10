// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SkillsBridge } from "@/types";

// framer-motion's useInView (pulled in transitively via CountUp/ScoreRail) needs
// IntersectionObserver, which jsdom does not implement.
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

// Imported after the mocks above so SkillsBridgeReview picks up the mocked modules.
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

// Verifies the fix for: the "Build my resume" CTA showed "you've used all your free resume
// generations" text but stayed clickable, so it still round-tripped to /api/generate-resume just
// to get told no. See lib/requireUser.ts (FREE_RESUME_LIMIT) and the `remaining`/`limit` props
// threaded down from app/(dashboard)/resume/new/page.tsx.
describe("SkillsBridgeReview resume-quota gating", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    pushMock.mockClear();
    getUserMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not call the API and pops the resume-limit modal when the free resume quota is exhausted", () => {
    render(
      <SkillsBridgeReview
        bridge={bridge}
        initialItems={[]}
        roles={[]}
        jobTitle="Business Analyst"
        companyName="Acme"
        jobDescription="job ad text"
        isPaidPlan={false}
        remaining={0}
        limit={2}
        onBack={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: /build my resume/i });

    // Visually dimmed, but NOT natively disabled - a native `disabled` button never dispatches a
    // click event, which would silently swallow the tap instead of surfacing the modal.
    expect(button).not.toBeDisabled();
    expect(button.className).toMatch(/opacity-50/);

    fireEvent.click(button);

    expect(fetch).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("You've used your free resumes");
  });

  it("still calls /api/generate-resume normally when quota remains", async () => {
    getUserMock.mockResolvedValue({ data: { user: { is_anonymous: false } } });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ resume: { id: "r1" } }),
    });

    render(
      <SkillsBridgeReview
        bridge={bridge}
        initialItems={[]}
        roles={[]}
        jobTitle="Business Analyst"
        companyName="Acme"
        jobDescription="job ad text"
        isPaidPlan={false}
        remaining={1}
        limit={2}
        onBack={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: /build my resume/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/generate-resume",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/resume/r1?fromGeneration=1"));
  });
});
