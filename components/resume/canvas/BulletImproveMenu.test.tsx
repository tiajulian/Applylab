// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BulletImproveMenu } from "./BulletImproveMenu";

afterEach(cleanup);

describe("BulletImproveMenu", () => {
  it("marks its portaled menu data-selection-keep so the editor's click-outside deselect ignores it", () => {
    render(createElement(BulletImproveMenu, { resumeId: "r1", bulletText: "Led a team", onAccept: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /improve this bullet/i }));
    expect(screen.getByRole("menu")).toHaveAttribute("data-selection-keep");
  });
});
