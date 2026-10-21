// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ResumePreviewPane } from "./ResumePreviewPane";
import { marginMmToPx } from "@/lib/pdf/pageGeometry";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import type { ResumeContent } from "@/types";

// ResumePreviewPane's sheet-scale effect needs ResizeObserver (jsdom doesn't implement it) - same
// per-file global-mocking convention BaseResumeTemplate.test.tsx already uses.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const resume: ResumeContent = {
  contact: { name: "Jamie Lee", phone: "0400 000 000", email: "jamie@example.com", location: "Sydney", linkedin: "", work_rights: "" },
  target_titles: [],
  summary: "Summary.",
  skills: [],
  tools: [],
  experience: [],
  projects: [],
  education: [],
  referees: [],
};

function renderPane(marginMm?: number) {
  return render(
    <ResumePreviewPane
      resume={resume}
      templateDef={getTemplateDefinition("clean")}
      fontSizePt={10}
      density={DEFAULT_DENSITY}
      marginMm={marginMm}
      onSectionClick={() => {}}
    />
  );
}

function contentPadding(container: HTMLElement) {
  return (container.querySelector('[style*="padding"]') as HTMLElement).style.padding;
}

// The editing canvas uses the exported PDF's own equal-on-every-side @page margin, so it wraps
// and paginates like the download (same as ResumePreviewModal).
describe("ResumePreviewPane margin matches the PDF (lib/resume/designPrefs.ts's MARGIN_MM)", () => {
  it("with no marginMm passed, uses the standard 13mm margin", () => {
    expect(contentPadding(renderPane().container)).toBe(`${marginMmToPx(13)}px`);
  });

  it.each([10, 13, 16])("%imm renders as the same px margin the PDF uses", (mm) => {
    expect(contentPadding(renderPane(mm).container)).toBe(`${marginMmToPx(mm)}px`);
  });
});
