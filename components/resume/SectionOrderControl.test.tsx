// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SectionOrderControl } from "./SectionOrderControl";

afterEach(cleanup);

describe("SectionOrderControl", () => {
  it("opens a drag-to-rearrange pop-up listing the sections, and Done closes it", async () => {
    render(<SectionOrderControl onSetOrder={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reorder sections" }));
    expect(screen.getByRole("dialog", { name: /rearrange the sections/i })).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    for (const label of ["Summary", "Experience", "Skills", "Tools & platforms", "Projects", "Education"]) {
      expect(screen.getByLabelText(`${label} - drag to move`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("lists only the sections the resume has, with up/down buttons that keep hidden ones in place", () => {
    const onSetOrder = vi.fn();
    render(
      <SectionOrderControl
        sectionOrder={["summary", "experience", "skills", "tools", "projects", "education"]}
        visibleSections={["summary", "experience", "skills"]}
        onSetOrder={onSetOrder}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Reorder sections" }));
    expect(screen.queryByLabelText("Projects - drag to move")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Summary up" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move Skills up" }));
    expect(onSetOrder).toHaveBeenCalledWith(["summary", "skills", "experience", "tools", "projects", "education"]);
  });

  it("closes on Escape", async () => {
    render(<SectionOrderControl onSetOrder={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reorder sections" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
