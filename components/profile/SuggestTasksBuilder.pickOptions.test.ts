import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/profile/useRoleDuties", () => ({ patchDutyItem: vi.fn() }));

import { pickOptions } from "./SuggestTasksBuilder";

describe("pickOptions", () => {
  it("lists picks already on the profile first, in the profile's own spelling", () => {
    expect(pickOptions(["Power BI", "sql", "Excel"], ["SQL", "Excel"], [])).toEqual(["SQL", "Excel", "Power BI"]);
  });

  it("keeps already-picked values in their own spelling so the chip shows as selected", () => {
    expect(pickOptions(["Finance team"], [], ["finance team", "Head of Sales"])).toEqual(["finance team", "Head of Sales"]);
  });

  it("is empty when the task has no suggestions and nothing picked, so its row stays hidden", () => {
    expect(pickOptions([], ["SQL", "Excel"], [])).toEqual([]);
  });
});
