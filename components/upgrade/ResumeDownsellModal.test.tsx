import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResumeDownsellModal } from "./ResumeDownsellModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/analytics", () => ({
  trackFunnelEvent: vi.fn(),
}));

describe("ResumeDownsellModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with exact handover copy and structure when open", () => {
    const markup = renderToStaticMarkup(
      createElement(ResumeDownsellModal, {
        isOpen: true,
        resumeId: "res-123",
        resumeTitle: "Data Analytics Engineer",
        onClose: () => {},
      })
    );

    // 1. Heading
    expect(markup).toContain("Send this one today.");

    // 2. Subhead with bold role title
    expect(markup).toContain('Your <strong class="font-semibold text-ink">Data Analytics Engineer</strong> resume, unlocked once. No subscription.');

    // 3. Three noun-phrase benefits (no full stops)
    expect(markup).toContain("PDF with no watermark");
    expect(markup).toContain("Editable Word file");
    expect(markup).toContain("Yours to keep, re-download any time");

    // 4. Struck-through price pill with accessible text
    expect(markup).toContain("$19 a month");
    expect(markup).toContain("instead of $19 a month");
    expect(markup).toContain("$2.99");
    expect(markup).toContain("once");

    // 5. Actions & Reassurance
    expect(markup).toContain("Unlock and download");
    expect(markup).toContain("Card or Apple Pay, about 20 seconds");
    expect(markup).toContain("Keep the watermark");

    // 6. Close button accessibility
    expect(markup).toContain('aria-label="Close"');

    // 7. Dialog accessibility & landmarks
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="unlock-modal-title"');

    // 8. Decorative circles present with aria-hidden
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("bg-success-soft");
    expect(markup).toContain("bg-accent-soft");
  });

  it("renders fallback subhead when resumeTitle is not provided", () => {
    const markup = renderToStaticMarkup(
      createElement(ResumeDownsellModal, {
        isOpen: true,
        resumeId: "res-123",
        onClose: () => {},
      })
    );

    expect(markup).toContain("Your resume, unlocked once. No subscription.");
  });

  it("strictly forbids em dashes or en dashes in any rendered modal copy", () => {
    const markup = renderToStaticMarkup(
      createElement(ResumeDownsellModal, {
        isOpen: true,
        resumeId: "res-123",
        resumeTitle: "Senior Frontend Engineer",
        onClose: () => {},
      })
    );

    expect(markup.includes("—")).toBe(false);
    expect(markup.includes("–")).toBe(false);
  });

  it("returns empty markup when isOpen is false", () => {
    const markup = renderToStaticMarkup(
      createElement(ResumeDownsellModal, {
        isOpen: false,
        resumeId: "res-123",
        onClose: () => {},
      })
    );

    expect(markup).toBe("");
  });
});

