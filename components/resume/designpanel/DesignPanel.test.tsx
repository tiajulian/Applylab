// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DesignPanel, type DesignPanelProps } from "./DesignPanel";

afterEach(cleanup);

function renderPanel(overrides: Partial<DesignPanelProps> = {}) {
  const handlers = {
    onSelectAccentColor: vi.fn(),
    onSelectFontChoice: vi.fn(),
    onSelectMarginPreset: vi.fn(),
    onSelectSpacingPreset: vi.fn(),
    onSelectLineHeightPreset: vi.fn(),
    onSelectFontSize: vi.fn(),
    onFitToOnePage: vi.fn(),
    onClose: vi.fn(),
  };
  const props: DesignPanelProps = {
    isMobile: false,
    accentColor: null,
    fontChoice: null,
    marginPreset: null,
    spacingPreset: null,
    lineHeightPreset: null,
    fontSizePt: 10,
    totalPages: 1,
    ...handlers,
    ...overrides,
  };
  render(<DesignPanel {...props} />);
  return handlers;
}

describe("DesignPanel", () => {
  it("the font dropdown lists every curated font plus a Default option, and selecting one reports its id", () => {
    const { onSelectFontChoice } = renderPanel();
    const select = screen.getByRole("combobox", { name: "Font" }) as HTMLSelectElement;
    expect(select.value).toBe("default");
    fireEvent.change(select, { target: { value: "georgia" } });
    expect(onSelectFontChoice).toHaveBeenCalledWith("georgia");
  });

  it("selecting Default resets the font to null (the template's own font)", () => {
    const { onSelectFontChoice } = renderPanel({ fontChoice: "georgia" });
    const select = screen.getByRole("combobox", { name: "Font" }) as HTMLSelectElement;
    expect(select.value).toBe("georgia");
    fireEvent.change(select, { target: { value: "default" } });
    expect(onSelectFontChoice).toHaveBeenCalledWith(null);
  });

  it("shows the font-size stepper and reports a change through onSelectFontSize", () => {
    const { onSelectFontSize } = renderPanel({ fontSizePt: 10 });
    fireEvent.click(screen.getByRole("button", { name: "Larger font" }));
    expect(onSelectFontSize).toHaveBeenCalledWith(10.5);
  });

  it("shows 'Fits on one page' when totalPages is 1, and a Fit to one page action otherwise", () => {
    renderPanel({ totalPages: 1 });
    expect(screen.getByText("Fits on one page")).toBeInTheDocument();
    cleanup();
    const { onFitToOnePage } = renderPanel({ totalPages: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Fit to one page" }));
    expect(onFitToOnePage).toHaveBeenCalled();
  });

  it("clicking an accent swatch reports that swatch's hex", () => {
    const { onSelectAccentColor } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Deep Navy" }));
    expect(onSelectAccentColor).toHaveBeenCalledWith("#1e3a8a");
  });

  it("clicking the accent 'Default' swatch reports null", () => {
    const { onSelectAccentColor } = renderPanel({ accentColor: "#1e3a8a" });
    fireEvent.click(screen.getByRole("button", { name: "Default (template's own color)" }));
    expect(onSelectAccentColor).toHaveBeenCalledWith(null);
  });

  it("margin/spacing/line-height presets: clicking 'Standard' reports null (the unset default), clicking another preset reports that preset", () => {
    const { onSelectMarginPreset } = renderPanel({ marginPreset: "compact" });
    const marginGroup = screen.getByRole("group", { name: "Page margins" });
    fireEvent.click(within(marginGroup).getByRole("button", { name: "Standard" }));
    expect(onSelectMarginPreset).toHaveBeenCalledWith(null);
  });

  it("reflects the current preset as aria-pressed on the matching button", () => {
    renderPanel({ spacingPreset: "spacious" });
    const spacingGroup = screen.getByRole("group", { name: "Section and bullet spacing" });
    expect(within(spacingGroup).getByRole("button", { name: "Spacious" })).toHaveAttribute("aria-pressed", "true");
    expect(within(spacingGroup).getByRole("button", { name: "Standard" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Escape closes the panel", () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("the close button closes the panel", () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Close design panel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
