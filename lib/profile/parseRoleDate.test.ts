import { describe, expect, it } from "vitest";
import { sortByRecency } from "./parseRoleDate";

interface Role {
  job_title: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

function role(job_title: string, start_date: string, end_date: string, is_current = false): Role {
  return { job_title, start_date, end_date, is_current };
}

describe("sortByRecency", () => {
  it("orders roles most-recent-first", () => {
    const roles = [
      role("Analyst Intern", "Jan 2018", "Dec 2019"),
      role("Senior Analyst", "Jan 2022", "Dec 2023"),
      role("Analyst", "Jan 2020", "Dec 2021"),
    ];
    expect(sortByRecency(roles).map((r) => r.job_title)).toEqual(["Senior Analyst", "Analyst", "Analyst Intern"]);
  });

  it("puts a current role first even if an earlier role ends later in text order", () => {
    const roles = [
      role("Past Role", "Jan 2020", "Dec 2022"),
      role("Current Role", "Jan 2023", "", true),
    ];
    expect(sortByRecency(roles).map((r) => r.job_title)).toEqual(["Current Role", "Past Role"]);
  });

  it("breaks a tie between two concurrent current roles by start date, most recent first", () => {
    const roles = [
      role("Older Concurrent Role", "Jan 2021", "", true),
      role("Newer Concurrent Role", "Jan 2023", "", true),
    ];
    expect(sortByRecency(roles).map((r) => r.job_title)).toEqual(["Newer Concurrent Role", "Older Concurrent Role"]);
  });

  it("falls back to start_date when end_date can't be parsed", () => {
    const roles = [
      role("Older Role", "Jan 2018", "not a date"),
      role("Newer Role", "Jan 2022", "not a date either"),
    ];
    expect(sortByRecency(roles).map((r) => r.job_title)).toEqual(["Newer Role", "Older Role"]);
  });

  it("keeps entries with no parseable date at all last, in original order", () => {
    const roles = [
      role("Undated Role A", "sometime", "sometime"),
      role("Dated Role", "Jan 2020", "Dec 2021"),
      role("Undated Role B", "whenever", "whenever"),
    ];
    expect(sortByRecency(roles).map((r) => r.job_title)).toEqual([
      "Dated Role",
      "Undated Role A",
      "Undated Role B",
    ]);
  });

  it("does not mutate the input array", () => {
    const roles = [role("A", "Jan 2018", "Dec 2019"), role("B", "Jan 2022", "Dec 2023")];
    const original = [...roles];
    sortByRecency(roles);
    expect(roles).toEqual(original);
  });
});
