// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WinBuilder } from "./WinBuilder";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ suggestion: "Rolled out a new POS system.", starters: [], used: 0, limit: 5 }) }));
  vi.stubGlobal("fetch", fetchMock);
  // framer-motion's in-view hook needs it; jsdom has none.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

function polishBodies() {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes("win-polish"))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

/** Opens the builder on a task, as the profile's "Make this stronger with AI" does, and walks to the number step. */
function openAtNumberStep() {
  render(
    createElement(WinBuilder, {
      jobTitle: "Venue Manager",
      description: "Rolled out new POS and inventory systems",
      profileTools: [],
      onAddProfileTool: vi.fn(),
      profileStakeholders: [],
      onAddProfileStakeholder: vi.fn(),
      initialWin: { text: "Rolled out new POS and inventory systems", what: "Rolled out new POS and inventory systems", metric: "" },
      onSave: vi.fn(),
      onClose: vi.fn(),
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "led" }));
  for (let i = 0; i < 6 && !screen.queryByText("Can you put a number on it?"); i++) {
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));
  }
  expect(screen.getByText("Can you put a number on it?")).toBeInTheDocument();
}

const polishButton = () => screen.getByRole("button", { name: /polish with ai/i });

describe("WinBuilder number step", () => {
  it("offers question chips, never ready-made numbers", () => {
    openAtNumberStep();
    for (const label of ["Time saved", "People", "Scale", "Fewer errors", "Money", "Speed"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect((screen.getByRole("textbox") as HTMLInputElement).value).not.toMatch(/\d/);
    }
  });

  it("blocks polish until the blank is filled, then sends the user's own number", async () => {
    openAtNumberStep();
    fireEvent.click(screen.getByRole("button", { name: "Speed" }));
    expect(polishButton()).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "30% faster" } });
    expect(polishButton()).toBeEnabled();
    fireEvent.click(polishButton());
    await waitFor(() => expect(polishBodies()).toHaveLength(1));
    expect(polishBodies()[0].metric).toBe("30% faster");
  });

  it("Skip with an unfilled template polishes with no metric at all", async () => {
    openAtNumberStep();
    fireEvent.click(screen.getByRole("button", { name: "Money" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(polishBodies()).toHaveLength(1));
    expect(polishBodies()[0].metric ?? "").toBe("");
  });
});
