import { describe, expect, it } from "vitest";
import {
  addEducation,
  addExperience,
  addExperienceBullet,
  addProject,
  addProjectBullet,
  addReferee,
  moveExperience,
  moveExperienceBullet,
  moveProjectBullet,
  removeEducation,
  removeExperience,
  removeExperienceBullet,
  removeProject,
  removeProjectBullet,
  removeReferee,
  setSkills,
  setTargetTitles,
  setTools,
  updateContact,
  updateEducation,
  updateExperience,
  updateExperienceBullet,
  updateProject,
  updateProjectBullet,
  updateReferee,
  updateSummary,
} from "./resumeFieldUpdaters";
import type { ResumeContent } from "@/types";

function baseResume(): ResumeContent {
  return {
    contact: { name: "Jamie", phone: "0400 000 000", email: "jamie@example.com", location: "", linkedin: "", work_rights: "" },
    target_titles: ["Coordinator"],
    summary: "Original summary",
    skills: ["Skill A"],
    tools: ["Category: Tool A"],
    experience: [
      {
        job_title: "Analyst",
        company: "Acme",
        company_description: "",
        location: "Sydney",
        start_date: "2020",
        end_date: "2021",
        bullets: ["Bullet 1", "Bullet 2"],
      },
    ],
    projects: [{ title: "Side project", context: "", year: "2022", bullets: ["Project bullet 1"] }],
    education: [{ degree: "BCom", institution: "Uni", year: "2018", notes: "" }],
    referees: [{ name: "Alex", title: "Lead", organisation: "Acme", phone: "0400", email: "alex@example.com" }],
  };
}

describe("resumeFieldUpdaters", () => {
  it("updateContact sets one contact field without touching others", () => {
    const next = updateContact(baseResume(), "phone", "0411 111 111");
    expect(next.contact.phone).toBe("0411 111 111");
    expect(next.contact.name).toBe("Jamie");
  });

  it("updateSummary replaces the summary", () => {
    expect(updateSummary(baseResume(), "New summary").summary).toBe("New summary");
  });

  it("setTargetTitles/setSkills/setTools replace the whole list", () => {
    const resume = baseResume();
    expect(setTargetTitles(resume, ["A", "B"]).target_titles).toEqual(["A", "B"]);
    expect(setSkills(resume, ["X"]).skills).toEqual(["X"]);
    expect(setTools(resume, ["Y"]).tools).toEqual(["Y"]);
  });

  it("addExperience prepends a blank role", () => {
    const next = addExperience(baseResume());
    expect(next.experience).toHaveLength(2);
    expect(next.experience[0].job_title).toBe("");
    expect(next.experience[1].job_title).toBe("Analyst");
  });

  it("removeExperience drops the role at the given index", () => {
    expect(removeExperience(baseResume(), 0).experience).toHaveLength(0);
  });

  it("moveExperience swaps adjacent roles and is a no-op out of bounds", () => {
    const resume = baseResume();
    resume.experience.push({ ...resume.experience[0], job_title: "Second role" });
    const moved = moveExperience(resume, 1, -1);
    expect(moved.experience.map((e) => e.job_title)).toEqual(["Second role", "Analyst"]);
    expect(moveExperience(resume, 0, -1)).toBe(resume); // out of bounds -> same reference
  });

  it("updateExperience patches only the targeted role", () => {
    const next = updateExperience(baseResume(), 0, { job_title: "Senior Analyst" });
    expect(next.experience[0].job_title).toBe("Senior Analyst");
    expect(next.experience[0].company).toBe("Acme");
  });

  it("experience bullet add/remove/move/update operate on the right role", () => {
    let resume = baseResume();
    resume = addExperienceBullet(resume, 0);
    expect(resume.experience[0].bullets).toEqual(["", "Bullet 1", "Bullet 2"]);

    resume = updateExperienceBullet(resume, 0, 0, "New first bullet");
    expect(resume.experience[0].bullets[0]).toBe("New first bullet");

    resume = moveExperienceBullet(resume, 0, 0, 1);
    expect(resume.experience[0].bullets).toEqual(["Bullet 1", "New first bullet", "Bullet 2"]);

    resume = removeExperienceBullet(resume, 0, 1);
    expect(resume.experience[0].bullets).toEqual(["Bullet 1", "Bullet 2"]);
  });

  it("project add/remove/update and bullet operations mirror experience", () => {
    let resume = baseResume();
    resume = addProject(resume);
    expect(resume.projects).toHaveLength(2);
    expect(resume.projects[0].title).toBe("");

    resume = updateProject(resume, 1, { title: "Renamed" });
    expect(resume.projects[1].title).toBe("Renamed");

    resume = addProjectBullet(resume, 1);
    expect(resume.projects[1].bullets[0]).toBe("");

    resume = updateProjectBullet(resume, 1, 0, "First");
    resume = moveProjectBullet(resume, 1, 0, 1);
    expect(resume.projects[1].bullets).toEqual(["Project bullet 1", "First"]);

    resume = removeProjectBullet(resume, 1, 0);
    expect(resume.projects[1].bullets).toEqual(["First"]);

    resume = removeProject(resume, 0);
    expect(resume.projects).toHaveLength(1);
  });

  it("education add/remove/update", () => {
    let resume = baseResume();
    resume = addEducation(resume);
    expect(resume.education).toHaveLength(2);
    resume = updateEducation(resume, 0, { degree: "MBA" });
    expect(resume.education[0].degree).toBe("MBA");
    resume = removeEducation(resume, 1);
    expect(resume.education).toHaveLength(1);
  });

  it("referee add/remove/update", () => {
    let resume = baseResume();
    resume = addReferee(resume);
    expect(resume.referees).toHaveLength(2);
    resume = updateReferee(resume, 0, { name: "Renamed" });
    expect(resume.referees[0].name).toBe("Renamed");
    resume = removeReferee(resume, 1);
    expect(resume.referees).toHaveLength(1);
  });
});
