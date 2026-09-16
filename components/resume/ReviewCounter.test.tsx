// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReviewCounter } from "./ReviewCounter";
import type { FactCheckFlag } from "@/types";

const untargetableFlag: FactCheckFlag = {
  severity: "high",
  location: "Referees",
  message: "Doesn't trace to your profile.",
  value: "Jane Doe",
};

afterEach(() => cleanup());

describe("ReviewCounter", () => {
  it("renders nothing when there are no flags and there never were any", () => {
    const { container } = render(
      <ReviewCounter targetableCount={0} untargetableFlags={[]} hadItemsInitially={false} onJumpNext={vi.fn()} onSelectUntargetable={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an 'all set' pill once every flag has been resolved", () => {
    render(
      <ReviewCounter targetableCount={0} untargetableFlags={[]} hadItemsInitially={true} onJumpNext={vi.fn()} onSelectUntargetable={vi.fn()} />
    );
    expect(screen.getByText(/all set, nothing left to review/i)).toBeInTheDocument();
  });

  it("shows the grouped total and calls onJumpNext when the pill is clicked", () => {
    const onJumpNext = vi.fn();
    render(
      <ReviewCounter
        targetableCount={2}
        untargetableFlags={[untargetableFlag]}
        hadItemsInitially={true}
        onJumpNext={onJumpNext}
        onSelectUntargetable={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "3 to review" }));
    expect(onJumpNext).toHaveBeenCalledTimes(1);
  });

  it("shows/hides the flag list and calls onSelectUntargetable with the right flag", () => {
    const onSelectUntargetable = vi.fn();
    render(
      <ReviewCounter
        targetableCount={1}
        untargetableFlags={[untargetableFlag]}
        hadItemsInitially={true}
        onJumpNext={vi.fn()}
        onSelectUntargetable={onSelectUntargetable}
      />
    );

    expect(screen.queryByText(untargetableFlag.message)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show list/i }));
    expect(screen.getByText(untargetableFlag.message)).toBeInTheDocument();

    fireEvent.click(screen.getByText(untargetableFlag.message));
    expect(onSelectUntargetable).toHaveBeenCalledWith(untargetableFlag);

    // Framer Motion's exit animation means the list node isn't removed synchronously in jsdom -
    // what matters here is that the toggle reports its new collapsed state.
    fireEvent.click(screen.getByRole("button", { name: /hide list/i }));
    expect(screen.getByRole("button", { name: /show list/i })).toHaveAttribute("aria-expanded", "false");
  });
});
