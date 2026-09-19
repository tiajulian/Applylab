// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BaseResumeTemplate } from "./BaseResumeTemplate";
import { TEMPLATE_METADATA } from "@/lib/resume/templateMetadata";
import type { ResumeContent } from "@/types";

// EditableField uses useIsMobile() (matchMedia) - jsdom doesn't implement it, so stub it
// desktop-always-false, matching this repo's existing per-file global-mocking convention.
// @dnd-kit/core's measuring also needs a ResizeObserver, which jsdom doesn't implement either.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tokens = TEMPLATE_METADATA.clean.tokens;

function baseResume(): ResumeContent {
  return {
    contact: { name: "Jamie Lee", phone: "0400 000 000", email: "jamie@example.com", location: "Sydney", linkedin: "", work_rights: "" },
    target_titles: ["Coordinator"],
    summary: "Original summary",
    skills: ["Skill A"],
    tools: ["Category: Tool A"],
    experience: [
      {
        job_title: "Analyst",
        company: "Acme",
        company_description: "",
        location: "Sydney",
        start_date: "2020",
        end_date: "2021",
        bullets: ["First bullet", "Second bullet"],
      },
    ],
    projects: [],
    education: [{ degree: "BCom", institution: "Uni", year: "2018", notes: "" }],
    referees: [],
  };
}

describe("BaseResumeTemplate - non-editable (export/preview) path is unchanged", () => {
  it("renders no input/textarea elements and no structural buttons when editable is omitted", () => {
    render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} />);
    expect(document.querySelectorAll("input, textarea")).toHaveLength(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Jamie Lee")).toBeInTheDocument();
    expect(screen.getByText("First bullet")).toBeInTheDocument();
  });

  it("renders identical markup whether editable is omitted or explicitly false", () => {
    const resume = baseResume();
    const a = render(<BaseResumeTemplate resume={resume} tokens={tokens} />);
    const htmlA = a.container.innerHTML;
    a.unmount();
    const b = render(<BaseResumeTemplate resume={resume} tokens={tokens} editable={false} />);
    expect(b.container.innerHTML).toBe(htmlA);
  });
});

describe("BaseResumeTemplate - editable canvas path", () => {
  // `selected` (a zone id like "experience") wires selection up, so that zone's toolbar is showing.
  function renderEditable(resume: ResumeContent, selected?: string) {
    const onFieldChange = vi.fn();
    const onFieldCommit = vi.fn();
    const onFieldBlur = vi.fn();
    render(
      <BaseResumeTemplate
        resume={resume}
        tokens={tokens}
        {...(selected ? { activeSection: selected, onSectionClick: vi.fn() } : {})}
        editable
        onFieldChange={onFieldChange}
        onFieldCommit={onFieldCommit}
        onFieldBlur={onFieldBlur}
      />
    );
    return { onFieldChange, onFieldCommit, onFieldBlur };
  }

  describe("selection-driven toolbars", () => {
    function renderSelectable(activeSection: string | null) {
      const resume = baseResume();
      const onSectionClick = vi.fn();
      const view = render(
        <BaseResumeTemplate resume={resume} tokens={tokens} editable activeSection={activeSection} onSectionClick={onSectionClick} />
      );
      return { onSectionClick, ...view };
    }

    it("does not show the section add control on hover unless the section is selected", async () => {
      renderSelectable(null);
      fireEvent.mouseEnter(screen.getByText("Professional Experience").parentElement!);
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByRole("button", { name: "Add role" })).not.toBeInTheDocument();
    });

    it("shows the section add control when the section is selected, without hovering", () => {
      renderSelectable("experience");
      expect(screen.getByRole("button", { name: "Add role" })).toBeInTheDocument();
    });

    it("selects an item (not its section) when it is clicked", () => {
      const { onSectionClick } = renderSelectable(null);
      fireEvent.click(screen.getByRole("button", { name: "Edit role item" }));
      expect(onSectionClick).toHaveBeenCalledTimes(1);
      expect(onSectionClick).toHaveBeenCalledWith("experience:0");
    });

    it("typing Space in a field inside a zone is not swallowed by the zone's key handler", () => {
      renderSelectable(null);
      const notPrevented = fireEvent.keyDown(screen.getByLabelText("Full name"), { key: " " });
      expect(notPrevented).toBe(true);
    });
  });

  it("typing the name calls onFieldChange with the full next resume, transient", () => {
    const resume = baseResume();
    const { onFieldChange } = renderEditable(resume);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Name" } });
    expect(onFieldChange).toHaveBeenCalledWith(expect.objectContaining({ contact: expect.objectContaining({ name: "New Name" }) }));
  });

  it("blurring a field calls onFieldBlur", () => {
    const resume = baseResume();
    const { onFieldBlur } = renderEditable(resume);
    fireEvent.blur(screen.getByLabelText("Professional summary"));
    expect(onFieldBlur).toHaveBeenCalledTimes(1);
  });

  it("editing a bullet calls onFieldChange with that bullet updated in place", () => {
    const resume = baseResume();
    const { onFieldChange } = renderEditable(resume);
    const bulletFields = screen.getAllByLabelText("Bullet point");
    fireEvent.change(bulletFields[1], { target: { value: "Second bullet edited" } });
    expect(onFieldChange).toHaveBeenCalledWith(
      expect.objectContaining({
        experience: [expect.objectContaining({ bullets: ["First bullet", "Second bullet edited"] })],
      })
    );
  });

  it("clicking Add role on the selected section's toolbar calls onFieldCommit with a role prepended", () => {
    const resume = baseResume();
    const { onFieldCommit } = renderEditable(resume, "experience");
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    expect(onFieldCommit).toHaveBeenCalledWith(
      expect.objectContaining({ experience: [expect.objectContaining({ job_title: "" }), expect.objectContaining({ job_title: "Analyst" })] })
    );
  });

  it("the section toolbar is labelled with its level and moves the section", () => {
    const resume = { ...baseResume(), section_order: ["summary", "experience", "skills", "tools", "projects", "education"] as const };
    const { onFieldCommit } = renderEditable({ ...resume, section_order: [...resume.section_order] }, "experience");
    expect(screen.getByText("Section: Experience")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move section down" }));
    expect(onFieldCommit).toHaveBeenCalledWith(
      expect.objectContaining({ section_order: ["summary", "skills", "experience", "tools", "projects", "education"] })
    );
  });

  it("removing a bullet calls onFieldCommit with that bullet removed, after revealing its hover toolbar", async () => {
    const resume = baseResume();
    const { onFieldCommit } = renderEditable(resume);

    // Remove/drag controls are hover/focus-revealed (not permanently inline) - see the Phase 2
    // cutover-review feedback that replaced the always-visible icon row this test used to assume.
    expect(screen.queryByRole("button", { name: "Remove bullet" })).not.toBeInTheDocument();
    const firstBulletLi = screen.getAllByLabelText("Bullet point")[0].closest("li")!;
    fireEvent.mouseEnter(firstBulletLi);

    const removeButtons = await waitFor(() => screen.getAllByRole("button", { name: "Remove bullet" }));
    fireEvent.click(removeButtons[0]);
    expect(onFieldCommit).toHaveBeenCalledWith(
      expect.objectContaining({ experience: [expect.objectContaining({ bullets: ["Second bullet"] })] })
    );
  });

  it("the section toolbar's bin empties that section's content", () => {
    const { onFieldCommit } = renderEditable(baseResume(), "experience");
    fireEvent.click(screen.getByRole("button", { name: "Delete Experience content" }));
    expect(onFieldCommit).toHaveBeenCalledWith(expect.objectContaining({ experience: [] }));
  });

  it("adding a skill when the list is empty still shows the section with an Add control", () => {
    const resume = { ...baseResume(), skills: [] };
    const { onFieldCommit } = renderEditable(resume, "skills");
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    expect(onFieldCommit).toHaveBeenCalledWith(expect.objectContaining({ skills: [""] }));
  });

  it("adding a referee shows fields for it, editing one calls onFieldChange", () => {
    const resume = baseResume();
    // No inline "+ Add referee" link: with none yet, a placeholder line is the selectable zone and
    // its section toolbar adds the first.
    const { onFieldCommit } = renderEditable(resume, "referees");
    expect(screen.queryByRole("button", { name: "+ Add referee" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add referee" }));
    expect(onFieldCommit).toHaveBeenCalledWith(
      expect.objectContaining({ referees: [expect.objectContaining({ name: "" })] })
    );

    const withReferee = { ...resume, referees: [{ name: "", title: "", organisation: "", phone: "", email: "" }] };
    cleanup();
    const { onFieldChange: onChange2 } = renderEditable(withReferee);
    fireEvent.change(screen.getByLabelText("Referee name"), { target: { value: "Alex Manager" } });
    expect(onChange2).toHaveBeenCalledWith(
      expect.objectContaining({ referees: [expect.objectContaining({ name: "Alex Manager" })] })
    );
  });

  it("does not render an Improve-with-AI trigger when resumeId is not provided, even when a bullet is hovered", async () => {
    renderEditable(baseResume());
    const firstBulletLi = screen.getAllByLabelText("Bullet point")[0].closest("li")!;
    fireEvent.mouseEnter(firstBulletLi);
    // "Remove bullet" (unlike "Drag to reorder", which the ancestor role's own toolbar also uses)
    // is a bullet-specific label, so it unambiguously confirms the bullet's toolbar activated.
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove bullet" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /improve this bullet/i })).not.toBeInTheDocument();
  });

  it("renders an Improve-with-AI trigger per hovered bullet when resumeId is provided", async () => {
    const resume = baseResume();
    render(<BaseResumeTemplate resume={resume} tokens={tokens} editable resumeId="resume-123" />);
    const bulletLis = screen.getAllByLabelText("Bullet point").map((el) => el.closest("li")!);
    fireEvent.mouseEnter(bulletLis[0]);
    fireEvent.mouseEnter(bulletLis[1]);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /improve this bullet/i })).toHaveLength(2));
  });

  it("renders a flag glyph and data-fc-target on a flagged referee, wired to onHighlightActivate", () => {
    // Referees used to be a documented gap: flagged rows got a background tint but no click
    // target, since the templates didn't render individual referees at all when that comment was
    // written. The canvas does now, so a flagged referee should be reachable like every other field.
    const resume = {
      ...baseResume(),
      referees: [{ name: "Jane Doe", title: "Manager", organisation: "Acme", phone: "0400", email: "jane@example.com" }],
    };
    const onHighlightActivate = vi.fn();
    render(
      <BaseResumeTemplate
        resume={resume}
        tokens={tokens}
        editable
        highlights={{ "referee:0": "flagged" }}
        onHighlightActivate={onHighlightActivate}
      />
    );

    const nameField = screen.getByLabelText("Referee name");
    expect(nameField).toHaveAttribute("data-fc-target", "referee:0");
    fireEvent.click(screen.getByRole("button", { name: /review flagged claim/i }));
    expect(onHighlightActivate).toHaveBeenCalledWith("referee:0", expect.anything());
  });

  it("shows only the bullet's own toolbar when a bullet is hovered, not the parent role's too", async () => {
    // A bullet's <li> sits inside its role's block, so the pointer entering the bullet also enters
    // the role's box in the same instant - the browser fires mouseenter on both. Without ancestor
    // suppression this would pop open two toolbars (bullet + role) at once for one hover.
    renderEditable(baseResume());
    const firstBulletLi = screen.getAllByLabelText("Bullet point")[0].closest("li")!;
    fireEvent.mouseEnter(firstBulletLi);
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove bullet" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Remove role" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Drag to reorder" })).toHaveLength(1);
  });
});
