// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BaseResumeTemplate } from "./BaseResumeTemplate";
import { TEMPLATE_METADATA } from "@/lib/resume/templateMetadata";
import type { ResumeContent } from "@/types";

afterEach(cleanup);

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
  function renderEditable(resume: ResumeContent) {
    const onFieldChange = vi.fn();
    const onFieldCommit = vi.fn();
    const onFieldBlur = vi.fn();
    render(
      <BaseResumeTemplate
        resume={resume}
        tokens={tokens}
        editable
        onFieldChange={onFieldChange}
        onFieldCommit={onFieldCommit}
        onFieldBlur={onFieldBlur}
      />
    );
    return { onFieldChange, onFieldCommit, onFieldBlur };
  }

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

  it("clicking + Add role calls onFieldCommit with a role prepended", () => {
    const resume = baseResume();
    const { onFieldCommit } = renderEditable(resume);
    fireEvent.click(screen.getByRole("button", { name: "+ Add role" }));
    expect(onFieldCommit).toHaveBeenCalledWith(
      expect.objectContaining({ experience: [expect.objectContaining({ job_title: "" }), expect.objectContaining({ job_title: "Analyst" })] })
    );
  });

  it("removing a bullet calls onFieldCommit with that bullet removed", () => {
    const resume = baseResume();
    const { onFieldCommit } = renderEditable(resume);
    const removeButtons = screen.getAllByRole("button", { name: "Remove bullet" });
    fireEvent.click(removeButtons[0]);
    expect(onFieldCommit).toHaveBeenCalledWith(
      expect.objectContaining({ experience: [expect.objectContaining({ bullets: ["Second bullet"] })] })
    );
  });

  it("adding a skill when the list is empty still shows the section with an Add control", () => {
    const resume = { ...baseResume(), skills: [] };
    const { onFieldCommit } = renderEditable(resume);
    fireEvent.click(screen.getByRole("button", { name: "+ Add skill" }));
    expect(onFieldCommit).toHaveBeenCalledWith(expect.objectContaining({ skills: [""] }));
  });
});
