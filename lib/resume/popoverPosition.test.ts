// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeSelectionToolbarStyle } from "./popoverPosition";

function rect(over: Partial<DOMRect>): DOMRect {
  return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}), ...over } as DOMRect;
}

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("innerHeight", 800);
});
afterEach(() => vi.unstubAllGlobals());

describe("computeSelectionToolbarStyle", () => {
  it("opens above the selection by default", () => {
    const style = computeSelectionToolbarStyle(rect({ top: 300, bottom: 320, left: 100, width: 80 }), 160);
    expect(style.top).toBeLessThan(300);
    expect(style.bottom).toBeUndefined();
  });

  it("flips below the selection when there isn't room above", () => {
    const style = computeSelectionToolbarStyle(rect({ top: 10, bottom: 30, left: 100, width: 80 }), 160);
    expect(style.top).toBeGreaterThanOrEqual(30);
  });

  it("centers horizontally over the selection", () => {
    const style = computeSelectionToolbarStyle(rect({ top: 300, bottom: 320, left: 500, width: 100 }), 160);
    // centre of selection (550) minus half the toolbar width (80) = 470.
    expect(style.left).toBe(470);
  });

  it("clamps horizontally so it never runs off either edge of the viewport", () => {
    const nearLeftEdge = computeSelectionToolbarStyle(rect({ top: 300, bottom: 320, left: 0, width: 10 }), 160);
    expect(nearLeftEdge.left).toBeGreaterThanOrEqual(16);

    const nearRightEdge = computeSelectionToolbarStyle(rect({ top: 300, bottom: 320, left: 1190, width: 10 }), 160);
    expect(Number(nearRightEdge.left) + 160).toBeLessThanOrEqual(1200);
  });
});
