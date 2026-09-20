import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
const rule = css.slice(css.indexOf("Resume canvas: outline the block under the pointer"));

describe("resume canvas hover outline (globals.css)", () => {
  it("outlines only the innermost hovered zone, and never the selected one", () => {
    expect(rule).toContain("[data-section]:not([data-zone-active]):hover:not(:has([data-section]:hover))");
  });

  it("is limited to pointer devices and to browsers that support :has", () => {
    expect(rule).toContain("@media (hover: hover)");
    expect(rule).toContain("@supports selector(:has(*))");
  });

  it("draws an outline, which takes no layout space, and sets no base outline that would hide the focus ring", () => {
    expect(rule).toMatch(/outline: 1\.5px solid/);
    expect(rule).toContain("outline-offset");
    // Every outline declaration sits inside the hover rule, none on a bare [data-section].
    expect(rule).not.toMatch(/\n\[data-section\]\s*\{/);
  });
});
