// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SectionOrderControl } from "./SectionOrderControl";

afterEach(cleanup);

describe("SectionOrderControl", () => {
  it("opens a drag-to-rearrange pop-up listing the sections, and Continue Editing closes it", async () => {
    render(<SectionOrderControl onSetOrder={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reorder sections" }));
    expect(screen.getByRole("dialog", { name: /rearrange the sections/i })).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    for (const label of ["Summary", "Experience", "Skills", "Tools & platforms", "Projects", "Education"]) {
      expect(screen.getByLabelText(`${label} - drag to move`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Continue Editing" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes on Escape", async () => {
    render(<SectionOrderControl onSetOrder={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reorder sections" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
