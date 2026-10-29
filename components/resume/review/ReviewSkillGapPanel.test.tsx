// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReviewSkillGapPanel } from "./ReviewSkillGapPanel";
import type { ResumeContent, SkillsBridgeItem } from "@/types";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const item = { id: "item", bridge_id: "bridge", source_company: "Acme", source_job_title: "Analyst", competency: "Did you train new starters?", target_requirement: "Staff training", state: "to_confirm", user_state: "pending", user_note: null } as SkillsBridgeItem;
const content = { experience: [{ company: "Acme", job_title: "Analyst" }] } as ResumeContent;
function panel() {
  const onChange = vi.fn();
  const onDraftChange = vi.fn();
  render(<ReviewSkillGapPanel context={{ bridgeId: "bridge", items: [item] }} content={content} onChange={onChange} onDraftChange={onDraftChange} />);
  return { onChange, onDraftChange };
}
describe("inline Skill Gap answers", () => {
  it("requires a real example, saves only to Skill Gap and exposes confirmed evidence", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ item: { ...item, user_state: "confirmed", user_note: "Trained two new starters." } }) });
    vi.stubGlobal("fetch", fetch);
    const { onChange, onDraftChange } = panel();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByRole("button", { name: "Save answer" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Trained two new starters." } });
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/skills-bridge/bridge/items/item");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ user_state: "confirmed", user_note: "Trained two new starters.", expected_user_state: "pending", expected_user_note: null });
    expect(onDraftChange).toHaveBeenLastCalledWith("skill-gap-item", false);
  });
  it("retains an answer after a failed save", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection lost")));
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "My real example" } });
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    expect(screen.getByRole("textbox")).toHaveValue("My real example");
  });
  it("lets users skip without saving a negative answer", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    panel(); fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Skipped for now.")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
});
