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
    onClose: vi.fn(),
  };
  const props: DesignPanelProps = {
    isMobile: false,
    accentColor: null,
    fontChoice: null,
    marginPreset: null,
    spacingPreset: null,
    lineHeightPreset: null,
    ...handlers,
    ...overrides,
  };
  render(<DesignPanel {...props} />);
  return handlers;
}

describe("DesignPanel", () => {
  it("clicking a font option reports that font's id", () => {
    const { onSelectFontChoice } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Georgia" }));
    expect(onSelectFontChoice).toHaveBeenCalledWith("georgia");
  });

  it("clicking 'Default' for font reports null (resets to the template's own font)", () => {
    const { onSelectFontChoice } = renderPanel({ fontChoice: "georgia" });
    fireEvent.click(screen.getByRole("button", { name: "Default" }));
    expect(onSelectFontChoice).toHaveBeenCalledWith(null);
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
