// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// A successful /api/skills-bridge response flips ResumeForm over to rendering
// <SkillsBridgeReview>, which calls next/navigation's useRouter() - needs a mock since there's no
// real App Router mounted in this test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Imported after the mock above so ResumeForm's SkillsBridgeReview child picks it up.
const { ResumeForm } = await import("./ResumeForm");

// Verifies the fix for: a free user who has exhausted their resume-generation quota could still
// click through to build a skills bridge, which only ever dead-ends at the same limit once they
// try to build the resume from it. See lib/requireUser.ts (FREE_RESUME_LIMIT) and
// app/(dashboard)/resume/new/page.tsx (computes `remaining` from resumes_used).
// framer-motion's useInView (pulled in transitively via CountUp, once a successful bridge
// response mounts <SkillsBridgeReview>'s <ScoreRail>) needs IntersectionObserver, which jsdom
// does not implement.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ResumeForm resume-quota gating", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it("does not call the API and pops the resume-limit modal when the free resume quota is exhausted", () => {
    render(<ResumeForm isPaidPlan={false} remaining={0} limit={2} />);

    const button = screen.getByRole("button", { name: /see how i match this job/i });

    // Visually dimmed, but NOT natively disabled - a native `disabled` button never dispatches a
    // click event, which would silently swallow the tap instead of surfacing the modal.
    expect(button).not.toBeDisabled();
    expect(button.className).toMatch(/opacity-50/);

    fireEvent.click(button);

    expect(fetch).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("You've used your free resumes");
  });

  it("keeps the button natively disabled when quota remains but Turnstile has not verified yet", () => {
    render(<ResumeForm isPaidPlan={false} remaining={1} limit={2} />);

    const button = screen.getByRole("button", { name: /see how i match this job/i });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still calls /api/skills-bridge normally when quota remains and Turnstile has verified", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ bridge: { id: "b1", mode: "advance" }, items: [], roles: [], projects: [] }),
    });

    // Stand in for the real Cloudflare script: TurnstileWidget finds `window.turnstile` already
    // present on mount and calls `.render()`, so invoking `options.callback` synchronously here
    // is equivalent to a user solving the real challenge.
    (window as unknown as { turnstile: unknown }).turnstile = {
      render: (_container: unknown, options: { callback: (token: string) => void }) => {
        options.callback("fake-token");
        return "widget-1";
      },
      remove: () => {},
      reset: () => {},
    };

    render(<ResumeForm isPaidPlan={false} remaining={1} limit={2} />);

    fireEvent.change(screen.getByLabelText(/job ad/i), { target: { value: "a".repeat(30) } });

    const button = screen.getByRole("button", { name: /see how i match this job/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(fetch).toHaveBeenCalledWith(
      "/api/skills-bridge",
      expect.objectContaining({ method: "POST" })
    );

    // Let the mocked fetch's promise settle and ResumeForm's resulting setBridgeState/re-render
    // (into <SkillsBridgeReview>) flush, so it doesn't leak into the next test as an unhandled
    // async update.
    await waitFor(() => expect(screen.getByText(/your skills bridge/i)).toBeInTheDocument());
  });
});
