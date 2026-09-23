// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ResumePreviewPane } from "./ResumePreviewPane";
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
      onOpenTemplateModal={() => {}}
      onSectionClick={() => {}}
    />
  );
}

describe("ResumePreviewPane margin preset scaling (lib/resume/designPrefs.ts's MARGIN_MM)", () => {
  it("with no marginMm passed, renders the exact same 26px/30px padding as before this feature existed", () => {
    const { container } = renderPane();
    const content = container.querySelector('[style*="padding"]') as HTMLElement;
    expect(content.style.padding).toBe("26px 30px");
  });

  it("13mm (the 'standard' preset value) also renders the unchanged default padding", () => {
    const { container } = renderPane(13);
    const content = container.querySelector('[style*="padding"]') as HTMLElement;
    expect(content.style.padding).toBe("26px 30px");
  });

  it("a smaller marginMm scales both padding numbers down by the same proportion", () => {
    // compact = 10mm: scale = 10/13 -> round(26*10/13)=20, round(30*10/13)=23.
    const { container } = renderPane(10);
    const content = container.querySelector('[style*="padding"]') as HTMLElement;
    expect(content.style.padding).toBe("20px 23px");
  });

  it("a larger marginMm scales both padding numbers up by the same proportion", () => {
    // spacious = 16mm: scale = 16/13 -> round(26*16/13)=32, round(30*16/13)=37.
    const { container } = renderPane(16);
    const content = container.querySelector('[style*="padding"]') as HTMLElement;
    expect(content.style.padding).toBe("32px 37px");
  });
});
