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
import { confirmedBridgeItems } from "@/lib/resume/factCheck";
import type { ConfirmedBridgeItem, SkillsBridgeItem } from "@/types";
import { integrityItems, spellingItems, styleItems } from "./rules";
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

describe("styleItems (bold/italic markers, lib/resume/bulletMarkup.ts)", () => {
  const bullet = (text: string) => ({ id: "experienceBullet:0:0", text, label: "Experience", writable: true });

  it("still finds a buzzword phrase split by an internal bold/italic marker", () => {
    // "team player" would be missed by a plain lower.includes(phrase) check against the raw marked
    // string, since the marker sits between "team" and "player".
    const [item] = styleItems(bullet("A dependable **team** player who ships."));
    expect(item.ruleId).toBe("style.buzzword");
  });

  it("still finds passive voice when the participle itself is bolded", () => {
    const [item] = styleItems(bullet("The report *was* **delivered** on time."));
    expect(item.ruleId).toBe("style.passive");
  });

  it("reports start/end in marked-up-string coordinates, so they correctly slice the raw stored text", () => {
    const text = "A **bold** team player who ships.";
    const [item] = styleItems(bullet(text));
    expect(item.ruleId).toBe("style.buzzword");
    expect(text.slice(item.start, item.end)).toBe(item.before);
  });

  it("behaves exactly as before on a bullet with no markers", () => {
    const text = "A team player who ships fast.";
    const [item] = styleItems(bullet(text));
    expect(item).toMatchObject({ ruleId: "style.buzzword", start: text.indexOf("team player"), before: "team player" });
  });

  it("includes a run's closing marker when the match ends flush with it, instead of leaving it dangling", () => {
    // The passive match ("was delivered") ends exactly where the bold run ("delivered") ends. A
    // start-biased end offset would land before "**delivered**"'s closing marker, leaving it
    // outside item.before (block.text.slice(start, end)) - an unbalanced "*was* **delivered".
    const text = "The report *was* **delivered** on time.";
    const [item] = styleItems(bullet(text));
    expect(item.ruleId).toBe("style.passive");
    expect(item.before.endsWith("**")).toBe(true);
    expect(item.before).toBe("*was* **delivered**");
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

  it("never turns a new claim (a figure the profile doesn't back) into a review item - that honesty check is off", () => {
    const withNewClaim = resume({ experience: [{ ...resume().experience[0], bullets: ["Cut report time by 65% with dbt."] }] });
    expect(run(withNewClaim).some((i) => i.ruleId === "provenance.new_claim")).toBe(false);
    // classifyBullet itself still sees it as a new claim - only surfacing it as a review item is gone.
    expect(classifyBullet("Cut report time by 65% with dbt.", profile, withNewClaim, 0).provenance).toBe("new_claim");
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

describe("integrity fixes in the review list", () => {
  const withTitle = (job_title: string) => resume({ experience: [{ ...resume().experience[0], job_title }] });
  const asItem = (raw: ReturnType<typeof integrityItems>[number]): ReviewItem => ({ ...raw, id: "x", resumeId: "r1", status: "open" });
  const titleItems = (c: ResumeContent) => integrityItems(c, listBlocks(c)).filter((i) => i.ruleId.startsWith("integrity.title"));

  it("offers Apply fix with the corrected text for a mechanical finding, and applying it clears the card", () => {
    const c = withTitle("analytics enginer");
    const item = titleItems(c).find((i) => i.ruleId === "integrity.title-case")!;
    expect(item).toMatchObject({ kind: "fix", before: "analytics enginer", after: "Analytics Engineer" });

    const next = applyFix(c, asItem(item));
    expect(next?.experience[0].job_title).toBe("Analytics Engineer");
    expect(titleItems(next!)).toEqual([]);
  });

  it("gives the typo card the same suggestion, so accepting either leaves the title right", () => {
    const c = withTitle("analytics enginer");
    const [caseItem, typoItem] = ["integrity.title-case", "integrity.title-typo"].map((rule) => titleItems(c).find((i) => i.ruleId === rule)!);
    expect(typoItem.after).toBe(caseItem.after);
    // The second card is stale once the first is applied: it no longer matches the text, so it is skipped.
    const once = applyFix(c, asItem(caseItem))!;
    expect(applyFix(once, asItem(typoItem))).toBeNull();
  });

  it("leaves a finding flag-only when there is no mechanical fix", () => {
    const c = resume({ experience: [{ ...resume().experience[0], company: "abc - sydney" }] });
    const placeholder = integrityItems(c, listBlocks(c)).find((i) => i.ruleId === "integrity.company-placeholder");
    expect(placeholder).toBeDefined();
    expect(placeholder?.after).toBe("");
  });

  it("never offers a no-op suggestion identical to the current text", () => {
    const c = withTitle("Analytics Engineer");
    expect(titleItems(c)).toEqual([]);
  });
});

describe("skills bridge confirmations count as evidence", () => {
  // The profile says nothing about Snowflake or "20 hours"; the person confirmed both in the skills bridge
  // and chose NOT to save them to the profile.
  const bulletFor = (text: string, roleCompany = "Acme") =>
    resume({
      tools: ["Data: Snowflake"],
      experience: [{ ...resume().experience[0], company: roleCompany, job_title: "Analytics Engineer", bullets: [text] }],
    });
  const confirmedNote: ConfirmedBridgeItem = {
    source_company: "Acme", source_job_title: "Analytics Engineer", competency: "Cloud data warehousing",
    target_requirement: "Snowflake experience", user_note: "Loaded reports into Snowflake, saving 20 hours a month.",
  };
  const classify = (text: string, confirmed?: ConfirmedBridgeItem[], company = "Acme") => {
    const withCompany: ProfileSource = {
      ...profile, work_experience: [{ ...profile.work_experience[0], company }], ...(confirmed ? { confirmed_bridge: confirmed } : {}),
    };
    return classifyBullet(text, withCompany, bulletFor(text, company), 0);
  };
  const text = "Loaded reports into Snowflake, saving 20 hours a month.";

  it("still asks when nothing was confirmed", () => {
    expect(classify(text).provenance).toBe("new_claim");
    expect(classify(text, []).provenance).toBe("new_claim");
  });

  it("does not ask again about a tool and number the person confirmed", () => {
    const result = classify(text, [confirmedNote]);
    expect(result.provenance).not.toBe("new_claim");
    expect(result.missing).toEqual([]);
  });

  it("backs a number only with the same role's confirmation, not another job's", () => {
    const otherRole = { ...confirmedNote, source_company: "Globex", source_job_title: "Data Analyst" };
    const result = classify(text, [otherRole]);
    // The tool is confirmed (anywhere in the profile counts), the 20 hours belongs to a different job.
    expect(result.provenance).toBe("new_claim");
    expect(result.missing.map((c) => c.text)).toEqual(["20"]);
  });

  it("only what was confirmed helps: a different claim in the same bullet is still flagged", () => {
    const result = classify("Loaded reports into Snowflake, saving 35 hours a month.", [confirmedNote]);
    expect(result.provenance).toBe("new_claim");
    expect(result.missing.map((c) => c.text)).toEqual(["35"]);
  });

  it("never backs a number with the job posting's requirement text, only with the person's own words", () => {
    const requirementOnly: ConfirmedBridgeItem = {
      source_company: "Acme", source_job_title: "Analytics Engineer", competency: "Cloud data warehousing",
      target_requirement: "5+ years of Snowflake", user_note: null,
    };
    const result = classify("Cut costs by 5% using Snowflake.", [requirementOnly]);
    // The tool is affirmed by the confirmation; the invented 5% is not.
    expect(result.missing.map((c) => c.text)).toEqual(["5%"]);
    expect(result.provenance).toBe("new_claim");
  });

  it("does not treat text copied from the job posting as the person's own wording", () => {
    const copied: ConfirmedBridgeItem = {
      source_company: "Acme", source_job_title: "Analytics Engineer", competency: "Cloud data warehousing",
      target_requirement: "Snowflake data warehousing", user_note: null,
    };
    const result = classify("Snowflake data warehousing", [copied]);
    expect(result.missing).toEqual([]);
    expect(result.provenance).toBe("reworded");
  });

  it("does treat the person's own note as their own wording", () => {
    const note: ConfirmedBridgeItem = { ...confirmedNote, user_note: "Snowflake data warehousing" };
    expect(classify("Snowflake data warehousing", [note]).provenance).toBe("profile");
  });

  it("leaves classification unchanged for a profile with no bridge at all", () => {
    expect(classifyBullet("Cut report time by 65% with dbt models.", profile, resume(), 0).provenance).toBe("new_claim");
  });
});

describe("confirmedBridgeItems", () => {
  const item = (over: Partial<SkillsBridgeItem>): SkillsBridgeItem => ({
    id: "i", bridge_id: "b", source_company: "Acme", source_job_title: "Analyst", source_snippet: "", competency: "SQL",
    target_requirement: "SQL reporting", state: "matched", confidence: "high", user_state: "confirmed", user_note: null, ...over,
  });

  it("keeps only confirmed items, and never a gap even if it somehow reads confirmed", () => {
    const items = [
      item({ id: "a" }),
      item({ id: "b", user_state: "pending" }),
      item({ id: "c", user_state: "rejected" }),
      item({ id: "d", state: "gap", user_state: "confirmed" }),
    ];
    expect(confirmedBridgeItems(items).map((i) => i.competency)).toEqual(["SQL"]);
    expect(confirmedBridgeItems(items)).toHaveLength(1);
  });

  it("carries the fields the review needs and nothing private", () => {
    expect(confirmedBridgeItems([item({ user_note: "my own words", source_snippet: "secret snippet" })])).toEqual([
      { source_company: "Acme", source_job_title: "Analyst", competency: "SQL", target_requirement: "SQL reporting", user_note: "my own words" },
    ]);
  });
});
