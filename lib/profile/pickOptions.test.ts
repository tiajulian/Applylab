import { describe, expect, it, vi } from "vitest";
import { MAX_PICKS_PER_LINE, addPick, pickOptions, saveNewPicksToProfile, togglePick } from "./pickOptions";

describe("pickOptions", () => {
  it("lists picks already on the profile first, in the profile's own spelling", () => {
    expect(pickOptions(["Power BI", "sql", "Excel"], ["SQL", "Excel"], [])).toEqual(["SQL", "Excel", "Power BI"]);
  });

  it("keeps already-picked values in their own spelling so the chip shows as selected", () => {
    expect(pickOptions(["Finance team"], [], ["finance team", "Head of Sales"])).toEqual(["finance team", "Head of Sales"]);
  });

  it("is empty when there are no suggestions and nothing picked, so the row stays hidden", () => {
    expect(pickOptions([], ["SQL", "Excel"], [])).toEqual([]);
  });
});

describe("togglePick / addPick", () => {
  it("toggles case-insensitively", () => {
    expect(togglePick(["Excel"], "excel")).toEqual([]);
    expect(togglePick(["Excel"], "SQL")).toEqual(["Excel", "SQL"]);
  });

  it("never grows past the cap", () => {
    const full = Array.from({ length: MAX_PICKS_PER_LINE }, (_, i) => `Tool ${i}`);
    expect(addPick(full, "One more")).toBe(full);
    expect(togglePick(full, "One more")).toBe(full);
  });
});

describe("saveNewPicksToProfile", () => {
  it("adds each new value once, skipping ones already on the profile in any casing", () => {
    const add = vi.fn();
    saveNewPicksToProfile([["SQL", "Power BI"], ["power bi", "Tableau"]], ["sql"], add);
    expect(add.mock.calls).toEqual([["Power BI"], ["Tableau"]]);
  });
});
