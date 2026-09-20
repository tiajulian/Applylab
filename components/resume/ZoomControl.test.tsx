// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZoomControl } from "./ZoomControl";

afterEach(cleanup);

const setup = (zoomPercent: number) => {
  const handlers = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onResetZoom: vi.fn() };
  render(<ZoomControl zoomPercent={zoomPercent} {...handlers} />);
  return handlers;
};

describe("ZoomControl", () => {
  it("zooms out, zooms in and resets to fit, showing the current level", () => {
    const h = setup(80);
    expect(screen.getByRole("group", { name: "Zoom" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom 80%, reset to fit" }));
    expect(screen.getByRole("button", { name: /reset to fit/ })).toHaveTextContent("80%");
    expect([h.onZoomOut, h.onZoomIn, h.onResetZoom].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it("disables a step at its limit so it cannot be pressed for nothing", () => {
    cleanup();
    setup(40);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeEnabled();
    cleanup();
    setup(250);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
  });

  it("uses 44px targets on touch screens and 36px on larger ones", () => {
    setup(100);
    expect(screen.getByRole("button", { name: "Zoom in" }).className).toContain("h-11 w-11");
  });
});
