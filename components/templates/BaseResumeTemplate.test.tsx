// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders a bullet's bold/italic markers as real <strong>/<em> elements, not literal asterisks - this is the exact path PDF export renders", () => {
    const resume = baseResume();
    resume.experience[0].bullets = ["**Led** a team of *five* engineers"];
    const { container } = render(<BaseResumeTemplate resume={resume} tokens={tokens} />);
    // querySelector("strong") alone would find the job title's own <strong> (unrelated whole-field
    // bold) first - scope to the bullet <li> specifically.
    const bulletLi = screen.getByText(/Led/).closest("li")!;
    expect(within(bulletLi).getByText("Led").tagName).toBe("STRONG");
    expect(within(bulletLi).getByText("five").tagName).toBe("EM");
    expect(container.textContent).not.toContain("**Led**");
    expect(container.textContent).not.toContain("*five*");
    expect(container.textContent).toContain("Led a team of five engineers");
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

    it("marks only the selected zone, so the hover outline steps aside for it", () => {
      renderSelectable("experience:0");
      const marked = Array.from(document.querySelectorAll("[data-zone-active]")).map((el) => el.getAttribute("data-section"));
      expect(marked).toEqual(["experience:0"]);
    });

    it("marks no zone when nothing is selected", () => {
      renderSelectable(null);
      expect(document.querySelectorAll("[data-zone-active]")).toHaveLength(0);
      expect(document.querySelectorAll("[data-section]").length).toBeGreaterThan(0);
    });

    describe("the + on a selected section's top edge", () => {
      const handle = (section: string) => screen.queryByRole("button", { name: new RegExp(`${section} at the top of this section`) });

      it("is there only while the section is selected", () => {
        renderSelectable(null);
        expect(document.querySelector("[data-section-insert]")).toBeNull();
        cleanup();
        renderSelectable("experience");
        expect(handle("Add role")).toBeInTheDocument();
      });

      it("is absent on a section with nothing to add, and on the read-only path", () => {
        renderSelectable("summary");
        expect(document.querySelector("[data-section-insert]")).toBeNull();
        cleanup();
        render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} />);
        expect(document.querySelector("[data-section-insert]")).toBeNull();
      });

      it("swaps for a labelled pill when clicked, and adds the new role at the TOP", () => {
        const resume = baseResume();
        const onFieldCommit = vi.fn();
        render(<BaseResumeTemplate resume={resume} tokens={tokens} editable activeSection="experience" onSectionClick={vi.fn()} onFieldCommit={onFieldCommit} />);
        fireEvent.click(handle("Add role")!);
        expect(handle("Add role")).toBeNull();
        // The toolbar's own "Add role" is a second button with this name, so pick the pill inside the handle.
        const pill = document.querySelector("[data-section-insert] button") as HTMLElement;
        expect(pill).toHaveTextContent("Add role");
        expect(onFieldCommit).not.toHaveBeenCalled();

        fireEvent.click(pill);
        expect(onFieldCommit).toHaveBeenCalledTimes(1);
        const next = onFieldCommit.mock.calls[0][0] as ResumeContent;
        expect(next.experience).toHaveLength(resume.experience.length + 1);
        expect(next.experience[0].job_title).toBe("");
        expect(next.experience.slice(1)).toEqual(resume.experience);
        // The pill goes away once used.
        expect(document.querySelector("[data-section-insert] button")).toHaveAttribute("aria-label");
      });

      it("adds a skill at the top, not the end (the toolbar's own Add appends)", () => {
        const resume = { ...baseResume(), skills: ["SQL", "Tableau"] };
        const onFieldCommit = vi.fn();
        render(<BaseResumeTemplate resume={resume} tokens={tokens} editable activeSection="skills" onSectionClick={vi.fn()} onFieldCommit={onFieldCommit} />);
        fireEvent.click(handle("Add skill")!);
        fireEvent.click(document.querySelector("[data-section-insert] button") as HTMLElement);
        expect((onFieldCommit.mock.calls[0][0] as ResumeContent).skills).toEqual(["", "SQL", "Tableau"]);

        onFieldCommit.mockClear();
        fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
        expect((onFieldCommit.mock.calls[0][0] as ResumeContent).skills).toEqual(["SQL", "Tableau", ""]);
      });

      it("closes on Escape and on a click elsewhere, without adding anything", async () => {
        const onFieldCommit = vi.fn();
        render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable activeSection="experience" onSectionClick={vi.fn()} onFieldCommit={onFieldCommit} />);
        fireEvent.click(handle("Add role")!);
        fireEvent.keyDown(document, { key: "Escape" });
        expect(handle("Add role")).toBeInTheDocument();

        fireEvent.click(handle("Add role")!);
        fireEvent.mouseDown(document.body);
        expect(handle("Add role")).toBeInTheDocument();
        expect(onFieldCommit).not.toHaveBeenCalled();
      });

      it("keeps keyboard focus on the same button when it opens, so Enter twice adds", () => {
        const onFieldCommit = vi.fn();
        render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable activeSection="experience" onSectionClick={vi.fn()} onFieldCommit={onFieldCommit} />);
        const button = handle("Add role")!;
        button.focus();
        fireEvent.click(button);
        expect(document.activeElement).toBe(button);
        expect(button).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(button);
        expect(onFieldCommit).toHaveBeenCalledTimes(1);
        expect(button).toHaveAttribute("aria-expanded", "false");
      });

      it("closes when focus moves away from it", () => {
        render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable activeSection="experience" onSectionClick={vi.fn()} />);
        const button = handle("Add role")!;
        button.focus();
        fireEvent.click(button);
        expect(button).toHaveAttribute("aria-expanded", "true");
        fireEvent.blur(button, { relatedTarget: document.body });
        expect(button).toHaveAttribute("aria-expanded", "false");
      });

      it("does not re-select the section or bubble the click to it", () => {
        const onSectionClick = vi.fn();
        render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable activeSection="experience" onSectionClick={onSectionClick} />);
        fireEvent.click(handle("Add role")!);
        expect(onSectionClick).not.toHaveBeenCalled();
      });
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
    // Bullets are contentEditable (EditableBullet), not a native textarea - there is no .value to
    // set via fireEvent.change; simulate what the browser does when someone types.
    bulletFields[1].textContent = "Second bullet edited";
    fireEvent.input(bulletFields[1]);
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

  it("tags the first referee field with data-fc-target", () => {
    const resume = {
      ...baseResume(),
      referees: [{ name: "Jane Doe", title: "Manager", organisation: "Acme", phone: "0400", email: "jane@example.com" }],
    };
    render(<BaseResumeTemplate resume={resume} tokens={tokens} editable />);
    expect(screen.getByLabelText("Referee name")).toHaveAttribute("data-fc-target", "referee:0");
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

  it("Add a metric: asks for a figure in the toolbar's menu and sends it to the assist API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ options: ["First bullet, cutting time by 30%"] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable resumeId="resume-123" />);
    const li = screen.getAllByLabelText("Bullet point")[0].closest("li")!;
    fireEvent.mouseEnter(li);
    fireEvent.click((await screen.findAllByRole("button", { name: /improve this bullet/i }))[0]);
    // The toolbar preventDefaults mousedown so a click here doesn't steal the bullet's focus (which
    // would deactivate the block and unmount this menu mid-request).
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Add a metric" }))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Add a metric" }));
    const input = await screen.findByLabelText(/what did you achieve/i);
    fireEvent.change(input, { target: { value: "30%" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to bullet" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "First bullet, cutting time by 30%" })).toBeInTheDocument();
  });

  it("keeps mousedown preventDefault on the AI menu's chips so clicking one doesn't steal the bullet's focus", async () => {
    render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable resumeId="resume-123" />);
    fireEvent.mouseEnter(screen.getAllByLabelText("Bullet point")[0].closest("li")!);
    fireEvent.click((await screen.findAllByRole("button", { name: /improve this bullet/i }))[0]);
    const chip = await screen.findByRole("button", { name: "Sharpen this line" });
    expect(fireEvent.mouseDown(chip)).toBe(false);
  });

  it("keeps the bullet's toolbar (and its AI menu) up while the menu is open, and lets go once it closes", async () => {
    render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable resumeId="resume-123" />);
    const li = screen.getAllByLabelText("Bullet point")[0].closest("li")!;
    fireEvent.mouseEnter(li);
    fireEvent.click((await screen.findAllByRole("button", { name: /improve this bullet/i }))[0]);
    await screen.findByRole("menu");

    fireEvent.mouseLeave(li);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole("button", { name: "Remove bullet" })).toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove bullet" })).not.toBeInTheDocument());
  });

  it("does not preventDefault on mousedown inside the metric input, so it stays focusable (unlike a plain toolbar button)", async () => {
    render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} editable resumeId="resume-123" />);
    fireEvent.mouseEnter(screen.getAllByLabelText("Bullet point")[0].closest("li")!);
    fireEvent.click((await screen.findAllByRole("button", { name: /improve this bullet/i }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add a metric" }));
    const input = await screen.findByLabelText(/what did you achieve/i);
    // fireEvent.mouseDown returns false when something in the bubble path called preventDefault -
    // exactly what would silently block the browser's real "focus this input" default action.
    expect(fireEvent.mouseDown(input)).toBe(true);
  });

  it("does not reassign the section's selection when focus lands in a portaled popover (the bullet AI menu's metric input)", async () => {
    // Pre-selects the role ("experience:0"), like a real click into one of its bullets would -
    // isolates the fix (onFocus bubbling past the role's own zone to the whole section's) from
    // reproducing that initial selection through a real focus cascade too.
    const onSectionClick = vi.fn();
    render(
      <BaseResumeTemplate
        resume={baseResume()}
        tokens={tokens}
        editable
        resumeId="resume-123"
        activeSection="experience:0"
        onSectionClick={onSectionClick}
      />
    );

    fireEvent.mouseEnter(screen.getAllByLabelText("Bullet point")[0].closest("li")!);
    fireEvent.click(await screen.findByRole("button", { name: /improve this bullet/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add a metric" }));
    const input = await screen.findByLabelText(/what did you achieve/i);

    // The metric input is portaled outside the role's DOM subtree - focus landing there used to
    // bubble (in React's *tree*, not the DOM, so the role zone's stopPropagation didn't stop it)
    // all the way out to the whole Experience section's own zone, which would reassign the
    // selection from "experience:0" to "experience" and collapse the role's (and bullet's) toolbar
    // mid-use, taking this popover down with it.
    onSectionClick.mockClear(); // clicking the sparkle/chip buttons harmlessly re-clicks the already-selected role zone too (unrelated to this fix) - only the focus-driven reassignment below is under test
    fireEvent.focus(input);

    expect(onSectionClick).not.toHaveBeenCalledWith("experience");
    expect(screen.getByRole("button", { name: "Remove bullet" })).toBeInTheDocument();
    expect(screen.getByLabelText(/what did you achieve/i)).toBeInTheDocument();
  });

  describe("editable bullet marker matches the non-editable render (regression: reported as 'editor doesn't match preview')", () => {
    it("uses a non-breaking space after the marker, not a plain space a flex layout can collapse", () => {
      renderEditable(baseResume());
      const marker = screen.getAllByLabelText("Bullet point")[0].closest("li")!.querySelector('span[aria-hidden="true"]')!;
      expect(marker.textContent).toBe("• ");
    });

    it("does not carry the non-editable branch's hanging-indent CSS (text-indent has no meaning in a flex row and was collapsing the marker to zero width)", () => {
      renderEditable(baseResume());
      const li = screen.getAllByLabelText("Bullet point")[0].closest("li")! as HTMLElement;
      expect(li.style.textIndent).toBe("0px");
      expect(li.style.paddingLeft).toBe("0px");
    });

    it("the non-editable (preview/export) branch keeps its own hanging-indent CSS unchanged", () => {
      render(<BaseResumeTemplate resume={baseResume()} tokens={tokens} />);
      const li = document.querySelector("li") as HTMLElement;
      expect(li.style.textIndent).toBe("-14px");
      expect(li.style.paddingLeft).toBe("14px");
    });
  });

  describe("EditableField's shrink-to-fit width for inline fields (job title/company/location/dates) (regression: reported as 'editor doesn't match preview')", () => {
    it("measures the field's actual rendered text width instead of the ch-based estimate, once canvas measurement is available", () => {
      // jsdom doesn't implement canvas getContext, so this only exercises the code path
      // (measureTextWidth's graceful zero-width fallback) rather than asserting an exact pixel
      // value - the precise fix was verified with a live-browser screenshot comparison instead
      // (app/dev/layout-verify, temporary, deleted once confirmed) since jsdom can't lay out text
      // with real font metrics.
      const resume = baseResume();
      resume.experience[0].job_title = "Production Manager Terminal";
      renderEditable(resume);
      const input = screen.getByLabelText("Job title") as HTMLInputElement;
      // Still renders the SSR-safe ch-based estimate (canvas measurement unavailable in jsdom) -
      // confirms the fallback path doesn't throw or leave the field unstyled.
      expect(input.style.width.endsWith("ch")).toBe(true);
    });
  });
});
