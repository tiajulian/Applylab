// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BulletImproveMenu } from "./BulletImproveMenu";

afterEach(cleanup);

/** The menu also fetches the free-usage count when it opens; these tests only care about the assist call. */
function assistCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/assist"));
}

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
    fireEvent.click(screen.getByRole("button", { name: "Do you have a number for this?" }));
    expect(assistCalls(fetchMock)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Metric (optional)"), { target: { value: "5 people" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview improved bullet" }));

    await waitFor(() => expect(assistCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(assistCalls(fetchMock)[0][1].body)).toMatchObject({ action: "quantify", metric: "5 people" });
    fireEvent.click(await screen.findByRole("button", { name: "Led a team of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Use this version" }));
    expect(onAccept).toHaveBeenCalledWith("Led a team of 5");
    vi.unstubAllGlobals();
  });

  it("strips bold/italic markers before sending bulletText to the assist API - the AI never sees them", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ options: ["Cleaner wording"] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(BulletImproveMenu, { resumeId: "r1", bulletText: "**Led** a team of *five*", onAccept: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /improve this bullet/i }));
    fireEvent.click(screen.getByRole("button", { name: "Sound more senior" }));
    await waitFor(() => expect(assistCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(assistCalls(fetchMock)[0][1].body).bulletText).toBe("Led a team of five");
    vi.unstubAllGlobals();
  });
});

// jsdom does not implement the native dialog top layer. Browser checks cover it.
Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });

Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
