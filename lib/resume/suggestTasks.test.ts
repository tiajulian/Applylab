import { describe, expect, it } from "vitest";
import { addTasksToRole, isThinRole, newTasksForRole, roleTaskMatcher, taskText, writtenBulletCount } from "./suggestTasks";
import type { ResumeContent, ResumeExperienceEntry } from "@/types";

const role = (bullets: string[]): ResumeExperienceEntry => ({
  job_title: "Barista",
  company: "Bean Co",
  company_description: "",
  location: "",
  start_date: "",
  end_date: "",
  bullets,
});

const resumeWith = (...roles: ResumeExperienceEntry[]) => ({ experience: roles }) as unknown as ResumeContent;

describe("isThinRole / writtenBulletCount", () => {
  it("counts only bullets with words in them", () => {
    expect(writtenBulletCount(role(["a", "", "**  **"]))).toBe(1);
    expect(isThinRole(role(["a", "b", ""]))).toBe(true);
    expect(isThinRole(role(["a", "b", "c"]))).toBe(false);
  });
});

describe("taskText / roleTaskMatcher", () => {
  it("prefers the candidate's own wording", () => {
    expect(taskText({ duty_text: "Made coffee", user_edited_text: "Made specialty coffee" })).toBe("Made specialty coffee");
    expect(taskText({ duty_text: " Made coffee ", user_edited_text: "  " })).toBe("Made coffee");
  });

  it("matches a bullet regardless of formatting, case and punctuation", () => {
    const has = roleTaskMatcher(role(["**Trained** new staff."]));
    expect(has("trained new staff")).toBe(true);
    expect(has("Trained new baristas")).toBe(false);
  });
});

describe("newTasksForRole", () => {
  it("drops tasks the role has, repeats and blanks - what the panel's count reports", () => {
    expect(newTasksForRole(role(["Made coffee"]), ["made coffee!", " Opened the store ", "Opened the store.", "  "])).toEqual(["Opened the store"]);
  });
});

describe("addTasksToRole", () => {
  it("appends after the last written bullet, leaving every existing bullet where it was", () => {
    // A blank in the middle stays put: review highlights are tied to a bullet's position.
    const resume = resumeWith(role(["Made coffee", "", "Cleaned up", "", ""]), role(["Other role"]));
    const next = addTasksToRole(resume, 0, ["Opened the store", "made coffee"]);
    expect(next.experience[0].bullets).toEqual(["Made coffee", "", "Cleaned up", "Opened the store"]);
    expect(next.experience[1]).toBe(resume.experience[1]);
  });

  it("gives a role with nothing written just the tasks", () => {
    expect(addTasksToRole(resumeWith(role([""])), 0, ["Opened the store"]).experience[0].bullets).toEqual(["Opened the store"]);
  });

  it("leaves the resume alone when there's nothing new or the role no longer exists", () => {
    const resume = resumeWith(role(["Made coffee"]));
    expect(addTasksToRole(resume, 0, ["Made coffee."])).toBe(resume);
    expect(addTasksToRole(resume, 3, ["x"])).toBe(resume);
  });
});
