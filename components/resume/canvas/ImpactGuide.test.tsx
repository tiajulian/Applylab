// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImpactGuide } from "./ImpactGuide";

afterEach(cleanup);
function setup() {
  const onGenerate = vi.fn();
  const onClose = vi.fn();
  render(<ImpactGuide bulletText="Prepared weekly reports" assistsLeft={2} loading={false} options={null} error={null} onGenerate={onGenerate} onAccept={vi.fn()} onClose={onClose} />);
  return { onGenerate, onClose };
}
describe("ImpactGuide", () => {
  it("does not retain a picked claim when the user says they are unsure", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "saved time" }));
    fireEvent.click(screen.getByRole("button", { name: "I’m not sure" }));
    expect(screen.getByLabelText("Who used your work, and what did they use it for?")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Who used your work, and what did they use it for?"), { target: { value: "My team used the reports" } });
    fireEvent.click(screen.getByRole("button", { name: "I’m not sure" }));
    expect(screen.getByLabelText("Who used your work, and what did they use it for?")).toHaveValue("My team used the reports");
  });
  it("lets the user edit the preview and applies it only on explicit acceptance", () => {
    const onAccept = vi.fn();
    render(<ImpactGuide bulletText="Prepared reports" assistsLeft={1} loading={false} options={["Prepared reports for weekly meetings"]} error={null} onGenerate={vi.fn()} onAccept={onAccept} onClose={vi.fn()} />);
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Make it your own"), { target: { value: "Prepared weekly reports for the team" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this version" }));
    expect(onAccept).toHaveBeenCalledWith("Prepared weekly reports for the team");
  });
  it("keeps answers when going back and never generates just from tapping a prompt", () => {
    const { onGenerate } = setup();
    fireEvent.click(screen.getByRole("button", { name: "saved time" }));
    fireEvent.change(screen.getByLabelText("What changed, or why did it matter?"), { target: { value: "Helped the team prepare meetings" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("What changed, or why did it matter?")).toHaveValue("Helped the team prepare meetings");
    expect(onGenerate).not.toHaveBeenCalled();
  });
  it("blocks unfilled metric templates and supports continuing without a number", () => {
    const { onGenerate } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    fireEvent.click(screen.getByRole("button", { name: "Time saved" }));
    expect(screen.getByRole("button", { name: "Preview improved bullet" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Continue without a number" }));
    expect(onGenerate).toHaveBeenCalledWith("", "");
  });
  it("asks before discarding answers", () => {
    const { onClose } = setup();
    fireEvent.change(screen.getByLabelText("What changed, or why did it matter?"), { target: { value: "Saved time" } });
    fireEvent.click(screen.getByRole("button", { name: "Close impact guide" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(screen.getByLabelText("What changed, or why did it matter?")).toHaveValue("Saved time");
  });
});

// jsdom does not implement the native dialog top layer. Browser checks cover it.
Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });

Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
