import { describe, expect, it } from "vitest";
import { APPLICATION_COLUMNS, countByColumn } from "./stageLabels";

describe("countByColumn", () => {
  it("counts the same groups the Applications board shows", () => {
    const counts = countByColumn([
      { status: "applied" },
      { status: "interviewing" },
      { status: "interviewing" },
      { status: "rejected" },
      { status: "withdrawn" },
    ]);
    expect(counts).toEqual({ applied: 1, interviewing: 2, offer: 0, finished: 2 });
    expect(APPLICATION_COLUMNS.map((c) => c.label)).toEqual(["Applied", "Interviewing", "Offer", "Finished"]);
  });
});
