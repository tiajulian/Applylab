// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BulletImproveMenu } from "./BulletImproveMenu";

afterEach(cleanup);

describe("BulletImproveMenu", () => {
  it("marks its portaled menu data-selection-keep so the editor's click-outside deselect ignores it", () => {
    render(createElement(BulletImproveMenu, { resumeId: "r1", bulletText: "Led a team", onAccept: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /improve this bullet/i }));
    expect(screen.getByRole("menu")).toHaveAttribute("data-selection-keep");
  });

  it("asks for the user's own number before calling the API for 'Add a metric'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ options: ["Led a team of 5"] }) });
    vi.stubGlobal("fetch", fetchMock);
    const onAccept = vi.fn();
    render(createElement(BulletImproveMenu, { resumeId: "r1", bulletText: "Led a team", onAccept }));
    fireEvent.click(screen.getByRole("button", { name: /improve this bullet/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add a metric" }));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/what did you achieve/i), { target: { value: "5 people" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to bullet" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ action: "quantify", metric: "5 people" });
    fireEvent.click(await screen.findByRole("button", { name: "Led a team of 5" }));
    expect(onAccept).toHaveBeenCalledWith("Led a team of 5");
    vi.unstubAllGlobals();
  });
});
