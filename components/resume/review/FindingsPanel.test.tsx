// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { FindingsPanel } from "./FindingsPanel";
import type { ResumeContent, ResumeReviewFinding, SkillsBridgeItem } from "@/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const content: ResumeContent = {
  contact: { name: "Sam Lee", email: "", phone: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [], summary: "Experienced analyst.", skills: [], tools: [], education: [], referees: [], projects: [],
  experience: [{ job_title: "Analyst", company: "Acme", company_description: "", location: "", start_date: "2022", end_date: "Present", bullets: ["Prepared reports."] }],
};
const finding: ResumeReviewFinding = {
  id: "claude-finding-0-content_quality", title: "Add detail to this bullet", category_key: "content_quality", severity: "warning", status: "open",
  detail: "Show who used the reports.", bullet_text: "Prepared reports.", fix_text: "Prepared reports for [add team].",
  target: { kind: "experienceBullet", index: 0, bulletIndex: 0 },
};
function panel(item = finding, options: { unlocked?: boolean; busy?: boolean; onAction?: ComponentProps<typeof FindingsPanel>["onAction"] } = {}) {
  const onAction = options.onAction ?? vi.fn().mockResolvedValue(undefined);
  const view = render(<FindingsPanel findings={[item]} content={content} resumeId="res-1" unlocked={options.unlocked ?? true}
    onAction={onAction} applyingFindingId={options.busy ? item.id : null} />);
  const open = () => fireEvent.click(screen.getByRole("button", { name: /Add detail to this bullet/ }));
  return { ...view, open, onAction };
}

describe("actionable review cards", () => {
  it("uses confirmed evidence only after selection and still requires explicit apply", async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const item = { id: "evidence", source_company: "Acme", source_job_title: "Analyst", state: "to_confirm", user_state: "confirmed", user_note: "Prepared weekly reports for finance." } as SkillsBridgeItem;
    render(<FindingsPanel findings={[finding]} content={content} resumeId="res-1" unlocked onAction={onAction} applyingFindingId={null}
      skillGap={{ bridgeId: "bridge", items: [item] }} />);
    fireEvent.click(screen.getByRole("button", { name: /Add detail to this bullet/ }));
    fireEvent.click(screen.getByText("Your confirmed evidence for this role"));
    fireEvent.click(screen.getByRole("button", { name: "Use this wording" }));
    expect(screen.getByRole("textbox", { name: /Suggested wording/ })).toHaveValue(item.user_note);
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith(finding, "apply", item.user_note, "Prepared reports."));
  });
  it("opens one finding at a time without losing another finding's draft", () => {
    const other = { ...finding, id: "other", title: "Another suggestion" };
    render(<FindingsPanel findings={[finding, other]} content={content} resumeId="res-1" unlocked onAction={vi.fn()} applyingFindingId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Add detail to this bullet/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Suggested wording/ }), { target: { value: "My draft wording." } });
    fireEvent.click(screen.getByRole("button", { name: /Another suggestion/ }));
    expect(screen.getByRole("button", { name: /Add detail to this bullet/ })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: /Add detail to this bullet/ }));
    expect(screen.getByRole("textbox", { name: /Suggested wording/ })).toHaveValue("My draft wording.");
  });
  it("asks for missing facts, previews their wording, and applies only a completed rewrite", async () => {
    const { open, onAction } = panel();
    open();
    expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Who did you do this work for or with?" }), { target: { value: "the finance team" } });
    expect(screen.getByRole("textbox", { name: /Suggested wording/ })).toHaveValue("Prepared reports for the finance team.");
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith(finding, "apply", "Prepared reports for the finance team.", "Prepared reports."));
  });
  it("preserves filled answers and edited wording when closed and reopened", () => {
    const { open } = panel();
    open();
    const rewrite = screen.getByRole("textbox", { name: /Suggested wording/ });
    fireEvent.change(rewrite, { target: { value: "Prepared weekly reports for finance." } });
    open(); open();
    expect(screen.getByRole("textbox", { name: /Suggested wording/ })).toHaveValue("Prepared weekly reports for finance.");
    expect(screen.getByText("Unsaved wording")).toBeVisible();
  });
  it("keeps a failed draft in place and allows a retry", async () => {
    const onAction = vi.fn().mockRejectedValueOnce(new Error("Could not save. Try again.")).mockResolvedValueOnce(undefined);
    const { open } = panel(finding, { onAction });
    open();
    fireEvent.change(screen.getByRole("textbox", { name: /Suggested wording/ }), { target: { value: "Prepared weekly reports." } });
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save. Try again.");
    expect(screen.getByRole("textbox", { name: /Suggested wording/ })).toHaveValue("Prepared weekly reports.");
    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
  });
  it("does not put an instruction into a resume field", () => {
    const { open } = panel({ ...finding, id: "integrity-bullet-case-0", replacement: undefined, fix_text: "Start the bullet with a capital letter." });
    open();
    expect(screen.getByRole("textbox", { name: "Your improved wording" })).toHaveValue("Prepared reports.");
    expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
  });
  it("allows keeping the original without filling in any blanks", async () => {
    const { open, onAction } = panel(); open();
    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith(finding, "dismiss", undefined, "Prepared reports."));
  });
  it("makes a kept suggestion available to undo without counting it as open", async () => {
    const item = { ...finding, status: "dismissed" as const };
    const { open, onAction } = panel(item); open();
    expect(screen.getByText("Kept yours")).toBeVisible();
    expect(screen.getByText(/Fix first · 0 left/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith(item, "undo", undefined, "Prepared reports."));
  });
  it("disables actions during another save", () => {
    const { open } = panel(finding, { busy: true }); open();
    expect(screen.getByRole("button", { name: "Keep mine" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Suggested wording/ })).toBeDisabled();
  });
  it("sends structural changes to the editor rather than offering an unsafe replacement", () => {
    const { open } = panel({ ...finding, target: { kind: "experienceHeader", index: 0, field: "dates" }, bullet_text: undefined }); open();
    expect(screen.queryByRole("button", { name: "Apply change" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open editor" })).toHaveAttribute("href", "/resume/res-1");
  });
  it("does not expose replacements or editable controls to a locked review", () => {
    panel(finding, { unlocked: false });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Show who used the reports.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock fixes" })).toBeVisible();
  });
});
