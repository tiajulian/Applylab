import { describe, it, expect } from "vitest";
import { stageToMode } from "./mode";
import type { InterviewStageType } from "@/types";

describe("stageToMode", () => {
  it("maps 'group' to coaching mode (no scored simulation)", () => {
    expect(stageToMode("group")).toBe("coaching");
  });

  const simulationStages: InterviewStageType[] = [
    "phone_screen",
    "technical",
    "panel",
    "async_video",
    "general",
  ];

  it.each(simulationStages)("maps '%s' to simulation mode", (stage) => {
    expect(stageToMode(stage)).toBe("simulation");
  });
});
