import { readFileSync } from "node:fs";
import nspell from "nspell";
import { describe, expect, it } from "vitest";
import { analyzeResume, snapshotBlocks } from "./analyze";
import { applyFix, applyFixes, revertChange } from "./apply";
import { actionLabels, sectionLabel, trustLine } from "./copy";
import { listBlocks } from "./blocks";
import { buildPassages } from "./engine";
import { clampReason } from "./types";
import { classifyBullet, type ProfileSource } from "./provenance";
import { spellingItems } from "./rules";
import type { ReviewItem } from "./types";
import type { ResumeContent } from "@/types";

// The real vendored en-AU dictionary: the launch requirement is about it, not a fixture.
const dir = "public/dictionaries/en-au";
const checker = nspell(readFileSync(`${dir}/en-au.aff`, "utf8"), readFileSync(`${dir}/en-au.dic`, "utf8"));

const resume = (over: Partial<ResumeContent> = {}): ResumeContent => ({
  contact: { name: "Sam", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [], summary: "", skills: [], tools: ["Data: dbt, SQL"], projects: [], education: [], referees: [],
  experience: [{ job_title: "Analytics Engineer", company: "Acme", company_description: "", location: "", start_date: "2021", end_date: "2024",
    bullets: ["Built dbt models that cut report time by 40%."] }],
  ...over,
});

const profile: ProfileSource = {
  work_experience: [{ job_title: "Analytics Engineer", company: "Acme", location: "", start_date: "2021", end_date: "2024", is_current: false, wins: [],
    description: "Built dbt models that cut report time by 40%.\nMentored two graduates." }],
  projects: [], education: [], skills: ["SQL"], tools: ["dbt", "SQL"], raw_linkedin_paste: null,
};

const block = (text: string) => ({ id: "summary", text, label: "Summary", writable: true });
const ctx = { checker, knownWords: new Set<string>() };

describe("spelling uses en-AU", () => {
  it("does not flag organise, centre or specialise", () => {
    expect(spellingItems(block("I organise events at the centre and specialise in logistics."), ctx)).toEqual([]);
  });

  it("does not flag dotted tech names or everyday resume words the dictionary lacks", () => {
    const text = "Engineered a scalable backend with Next.js and Node.js microservices and an API roadmap.";
    expect(spellingItems(block(text), ctx)).toEqual([]);
  });

  it("flags a genuine typo with a location, a reason and a fix", () => {
    const [item] = spellingItems(block("We recieved feedback."), ctx);
    expect(item).toMatchObject({ before: "recieved", after: "received", start: 3, end: 11, severity: "warn" });
    expect(item.reason.length).toBeGreaterThan(0);
  });

  it("explains a US spelling as Australian English", () => {
    const [item] = spellingItems(block("We organize events."), ctx);
    expect(item.reason).toBe("Australian English: 'organise'");
  });
});

describe("classifyBullet", () => {
  const classify = (bullet: string, p = profile) => classifyBullet(bullet, p, resume({ experience: [{ ...resume().experience[0], bullets: [bullet] }] }), 0);

  it("profile: the candidate's own words", () => {
    expect(classify("Built dbt models that cut report time by 40%.").provenance).toBe("profile");
  });

  it("reworded: same numbers and tools, new wording", () => {
    const r = classify("Cut report time by 40% with dbt models.");
    expect(r.provenance).toBe("reworded");
    expect(r.source).toContain("Built dbt models");
  });

  it("new_claim: a number that is not in the profile", () => {
    const r = classify("Cut report time by 65% with dbt models.");
    expect(r.provenance).toBe("new_claim");
    expect(r.missing.map((c) => c.text)).toEqual(["65%"]);
  });

  it("new_claim: a tool that is not in the profile", () => {
    const r = classifyBullet("Modelled data in Snowflake.", profile, resume({ tools: ["Data: Snowflake"] }), 0);
    expect(r.provenance).toBe("new_claim");
    expect(r.missing[0].text).toBe("Snowflake");
  });

  it("new_claim: an employer the profile lacks", () => {
    const r = classifyBullet("Applied lessons from Globex.", profile, resume({
      experience: [resume().experience[0], { ...resume().experience[0], company: "Globex", bullets: [] }],
    }), 0);
    expect(r.provenance).toBe("new_claim");
  });

  it("accepts 40 percent for 40%", () => {
    const p = { ...profile, work_experience: [{ ...profile.work_experience[0], description: "Cut report time by 40 percent using dbt." }] };
    expect(classify("Cut report time by 40% using dbt.", p).provenance).not.toBe("new_claim");
  });
});

describe("analyzeResume", () => {
  const run = (content: ResumeContent, prev: ReviewItem[] = [], previous: ReturnType<typeof snapshotBlocks> | null = null) =>
    analyzeResume({ resumeId: "r1", content, prev, previous, ctx: { checker, profile, flags: [] }, dismissed: new Set(), kept: new Set() });
  const withSummary = (summary: string) => resume({ summary });

  it("finds spelling in the summary and counts one passage", () => {
    const items = run(withSummary("We recieved feedback."));
    expect(items.filter((i) => i.ruleId === "spelling")).toHaveLength(1);
    expect(buildPassages(items)).toHaveLength(1);
  });

  it("re-analyses only changed blocks", () => {
    const first = withSummary("We recieved feedback.");
    const items = run(first);
    // Same content but a bullet edited: the summary's item must be carried over untouched.
    const edited = { ...first, experience: [{ ...first.experience[0], bullets: ["Built dbt models that cut report time by 40%. Also more."] }] };
    const next = run(edited, items, snapshotBlocks(listBlocks(first)));
    expect(next.find((i) => i.ruleId === "spelling")).toEqual(items.find((i) => i.ruleId === "spelling"));
  });

  it("auto-resolves when the misspelling is fixed or the text deleted", () => {
    const first = withSummary("We recieved feedback.");
    const items = run(first);
    const fixed = run(withSummary("We received feedback."), items, snapshotBlocks(listBlocks(first)));
    expect(fixed.find((i) => i.ruleId === "spelling")?.status).toBe("resolved");
    expect(buildPassages(fixed)).toHaveLength(0);
  });

  it("resolves items when their bullet is deleted, without error", () => {
    const first = resume({ experience: [{ ...resume().experience[0], bullets: ["We recieved 99% feedback."] }] });
    const items = run(first);
    expect(items.some((i) => i.status === "open")).toBe(true);
    const gone = run({ ...first, experience: [{ ...first.experience[0], bullets: [] }] }, items, snapshotBlocks(listBlocks(first)));
    expect(gone.filter((i) => i.status === "open" && i.blockId.startsWith("experienceBullet"))).toEqual([]);
  });

  it("keeps a bullet's new-claim item stable across unrelated edits", () => {
    const first = resume({ experience: [{ ...resume().experience[0], bullets: ["Cut report time by 65% with dbt."] }] });
    const a = run(first).find((i) => i.ruleId === "provenance.new_claim");
    const edited = { ...first, summary: "Hello." };
    const b = run(edited, run(first), snapshotBlocks(listBlocks(first))).find((i) => i.ruleId === "provenance.new_claim");
    expect(a && b && a.id === b.id).toBe(true);
  });
});

describe("apply and bulk", () => {
  const item = (over: Partial<ReviewItem>): ReviewItem => ({
    id: "x", resumeId: "r1", kind: "fix", ruleId: "spelling", severity: "warn", blockId: "summary", start: 0, end: 1, before: "", after: "",
    reason: "r", status: "open", ...over,
  });

  it("applies several fixes in one block without shifting offsets", () => {
    const c = resume({ summary: "teh cat recieved" });
    const items = [item({ start: 0, end: 3, before: "teh", after: "the" }), item({ id: "y", start: 8, end: 16, before: "recieved", after: "received" })];
    expect(applyFixes(c, items).content.summary).toBe("the cat received");
  });

  it("skips a stale fix", () => {
    expect(applyFix(resume({ summary: "changed" }), item({ before: "teh", after: "the", end: 3 }))).toBeNull();
  });

  it("reverts a change to the candidate's wording only while the bullet is unedited", () => {
    const c = resume();
    const change = item({ kind: "change", blockId: "experienceBullet:0:0", before: "Original.", after: c.experience[0].bullets[0] });
    expect(revertChange(c, change)?.experience[0].bullets[0]).toBe("Original.");
    expect(revertChange(c, { ...change, after: "stale" })).toBeNull();
    expect(revertChange(c, { ...change, before: "" })).toBeNull();
  });
});

describe("card copy", () => {
  const mk = (over: Partial<ReviewItem>): ReviewItem => ({
    id: "x", resumeId: "r1", kind: "fix", ruleId: "spelling", severity: "warn", blockId: "summary", start: 0, end: 1,
    before: "a", after: "b", reason: "Possible spelling mistake: 'a'", status: "open", ...over,
  });

  it("colours the trust line by how much attention the card needs", () => {
    expect(trustLine(mk({ kind: "change", provenance: "reworded" }))).toEqual({ tone: "safe", text: "Facts unchanged. Same numbers and tools as your profile." });
    expect(trustLine(mk({ kind: "change", provenance: "new_claim", claims: ["40%"] }))).toEqual({
      tone: "verify", text: "New detail: '40%' is not in your profile. Confirm it or edit it out.",
    });
    expect(trustLine(mk({ kind: "change", provenance: "new_claim", claims: ["6", "dbt"] })).text).toBe(
      "New detail: '6', 'dbt' are not in your profile. Confirm them or edit them out."
    );
    expect(trustLine(mk({ kind: "change", ruleId: "factcheck.metric", reason: "Unverified metric" }))).toEqual({ tone: "verify", text: "Unverified metric" });
    expect(trustLine(mk({}))).toEqual({ tone: "fix", text: "Possible spelling mistake: 'a'" });
  });

  it("names the buttons for the kind of card", () => {
    expect(actionLabels(mk({}))).toEqual({ accept: "Apply fix", keep: "Dismiss" });
    expect(actionLabels(mk({ kind: "change" }))).toEqual({ accept: "Accept", keep: "Keep original" });
  });

  it("splits a block label into the section and its entry", () => {
    expect(sectionLabel("Experience, Analytics Engineer")).toEqual({ full: "Experience · Analytics Engineer", short: "Analytics Engineer" });
    expect(sectionLabel("Summary")).toEqual({ full: "Summary", short: "Summary" });
  });
});

describe("clampReason", () => {
  it("keeps a full-length fact-check message and only shortens a runaway one", () => {
    const message = `The skill "Big Data Interrogation" doesn't trace to anything in your profile. Check it wasn't added from the job description.`;
    expect(clampReason(message)).toBe(message);
    const long = "x".repeat(500);
    expect(clampReason(long).length).toBeLessThanOrEqual(240);
    expect(clampReason(long).endsWith("…")).toBe(true);
  });
});
