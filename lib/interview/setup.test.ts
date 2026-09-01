import { describe, it, expect } from "vitest";
import {
  STAGES,
  ANSWER_MODES,
  PRESSURE_OPTIONS,
  QUESTION_DISPLAY_OPTIONS,
  resolveStage,
} from "./setupConstants";
import type { InterviewStageType } from "@/types";

describe("Interview Setup Redesign Configurations", () => {
  it("contains all six canonical interview stages in correct priority order", () => {
    const expectedOrder: InterviewStageType[] = [
      "general",
      "phone_screen",
      "panel",
      "technical",
      "async_video",
      "group",
    ];
    const stageTypes = STAGES.map((s) => s.type);
    expect(stageTypes).toEqual(expectedOrder);
  });

  it("applies plain-language titles per redesign handover specification", () => {
    expect(STAGES.find((s) => s.type === "general")?.title).toBe("Standard interview");
    expect(STAGES.find((s) => s.type === "phone_screen")?.title).toBe("First phone call");
    expect(STAGES.find((s) => s.type === "panel")?.title).toBe("Panel of interviewers");
    expect(STAGES.find((s) => s.type === "technical")?.title).toBe("Skills and know-how");
    expect(STAGES.find((s) => s.type === "async_video")?.title).toBe("Recorded video");
    expect(STAGES.find((s) => s.type === "group")?.title).toBe("Group assessment day");
  });

  it("applies badges only to Standard interview ('Most popular') and Group ('Advice only')", () => {
    const generalStage = STAGES.find((s) => s.type === "general");
    expect(generalStage?.badge).toBe("Most popular");

    const groupStage = STAGES.find((s) => s.type === "group");
    expect(groupStage?.badge).toBe("Advice only");

    const unbadgedStages = STAGES.filter((s) => s.type !== "general" && s.type !== "group");
    for (const stage of unbadgedStages) {
      expect(stage.badge).toBeUndefined();
    }
  });

  it("enforces card copy and rail summary parity", () => {
    for (const stage of STAGES) {
      expect(stage.title).toBeTruthy();
      expect(stage.description).toBeTruthy();
      expect(stage.length).toBeTruthy();
      expect(stage.questions).toBeTruthy();
      expect(stage.persona).toBeTruthy();
      expect(stage.feedbackOn).toBeTruthy();

      // Meta string must contain the exact same length and question count
      expect(stage.meta).toContain(stage.length);
      expect(stage.meta).toContain(stage.questions);
    }
  });

  it("ensures descriptions are concise and fit 2 lines (< 75 characters)", () => {
    for (const stage of STAGES) {
      expect(stage.description.length).toBeLessThanOrEqual(75);
      expect(stage.description.length).toBeGreaterThan(30);
    }
  });

  it("strictly forbids em dashes anywhere in stage, mode, pressure, or display copy", () => {
    const checkNoEmDashes = (str: string, context: string) => {
      expect(str.includes("—"), `Found em dash (—) in ${context}: "${str}"`).toBe(false);
      expect(str.includes("–"), `Found en dash (–) in ${context}: "${str}"`).toBe(false);
      expect(str.includes(" -- "), `Found double hyphen ( -- ) in ${context}: "${str}"`).toBe(false);
    };

    for (const stage of STAGES) {
      checkNoEmDashes(stage.title, `stage title (${stage.type})`);
      checkNoEmDashes(stage.description, `stage description (${stage.type})`);
      checkNoEmDashes(stage.persona, `stage persona (${stage.type})`);
      checkNoEmDashes(stage.feedbackOn, `stage feedbackOn (${stage.type})`);
      checkNoEmDashes(stage.meta, `stage meta (${stage.type})`);
    }

    for (const [key, mode] of Object.entries(ANSWER_MODES)) {
      checkNoEmDashes(mode.title, `answer mode title (${key})`);
      checkNoEmDashes(mode.description, `answer mode description (${key})`);
      checkNoEmDashes(mode.railLabel, `answer mode rail label (${key})`);
    }

    for (const [key, p] of Object.entries(PRESSURE_OPTIONS)) {
      checkNoEmDashes(p.label, `pressure label (${key})`);
      checkNoEmDashes(p.hint, `pressure hint (${key})`);
    }

    for (const [key, d] of Object.entries(QUESTION_DISPLAY_OPTIONS)) {
      checkNoEmDashes(d.label, `display label (${key})`);
      checkNoEmDashes(d.hint, `display hint (${key})`);
    }
  });

  it("resolves stage types from query parameters and interview stages", () => {
    expect(resolveStage("phone_screen")).toBe("phone_screen");
    expect(resolveStage("screening")).toBe("phone_screen");
    expect(resolveStage("technical")).toBe("technical");
    expect(resolveStage("panel")).toBe("panel");
    expect(resolveStage("async_video")).toBe("async_video");
    expect(resolveStage("group")).toBe("group");
    expect(resolveStage("assessment_centre")).toBe("group");
    expect(resolveStage(undefined, "technical")).toBe("technical");
    expect(resolveStage(undefined, undefined)).toBe("general");
    expect(resolveStage("unknown_stage")).toBe("general");
  });
});
