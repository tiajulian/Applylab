import { describe, expect, it } from "vitest";
import {
  anchorBridgeItem,
  buildConfirmedBridge,
  buildConfirmedRoleDuties,
  flagRetailorDrift,
  flagUnconfirmedBridgeClaims,
  flagUnverifiedFacts,
} from "./factCheck";
import type {
  ConfirmedBridge,
  ConfirmedRoleDuty,
  ResumeContent,
  RoleDutyItem,
  RoleDutySuggestion,
  SkillsBridgeItem,
  UserProfile,
} from "@/types";

const PROFILE: UserProfile = {
  id: "p1",
  user_id: "u1",
  work_rights: "Australian citizen",
  phone: "0400 000 000",
  location: "Parramatta, NSW",
  linkedin_url: null,
  work_experience: [
    {
      job_title: "Business Analyst",
      company: "Woolworths Group",
      location: "Sydney, NSW",
      start_date: "2022",
      end_date: "Present",
      description: "Led process improvement initiatives that cut reporting time by 30%.",
      achievement: "",
      achievement_metric: "",
    },
  ],
  projects: [
    {
      title: "Community Garden Tracker",
      description: "Built a small app to track volunteer shifts and plot assignments.",
      context: "Local volunteer group",
      timeframe: "2023",
      tools: ["React", "Supabase"],
      link: "",
      outcome: "Adopted by the group to replace a shared spreadsheet.",
      outcome_metric: "",
    },
  ],
  education: [{ degree: "Bachelor of Commerce", institution: "University of Melbourne", year: "2018", notes: "" }],
  skills: ["SQL", "Excel"],
  referees: [{ name: "Alex Manager", title: "Team Lead", organisation: "Woolworths Group", phone: "0400 111 111", email: "alex@example.com" }],
  raw_linkedin_paste: null,
  updated_at: "2024-01-01",
};

function baseResume(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    contact: { name: "Jamie", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
    target_titles: [],
    summary: "",
    skills: [],
    tools: [],
    projects: [],
    experience: [
      {
        job_title: "Business Analyst",
        company: "Woolworths Group",
        company_description: "",
        location: "Sydney, NSW",
        start_date: "2022",
        end_date: "Present",
        bullets: ["Cut reporting time by 30% through process improvements."],
      },
    ],
    education: [{ degree: "Bachelor of Commerce", institution: "University of Melbourne", year: "2018", notes: "" }],
    referees: [{ name: "Alex Manager", title: "Team Lead", organisation: "Woolworths Group", phone: "0400 111 111", email: "alex@example.com" }],
    ...overrides,
  };
}

describe("flagUnverifiedFacts", () => {
  it("returns no flags for a resume faithful to the profile", () => {
    expect(flagUnverifiedFacts(baseResume(), PROFILE)).toEqual([]);
  });

  it("flags a fabricated metric not present in the profile description", () => {
    const resume = baseResume({
      experience: [
        {
          ...baseResume().experience[0],
          bullets: ["Increased revenue by 500% through strategic initiatives."],
        },
      ],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.value === "500%")).toBe(true);
  });

  it("flags a company that doesn't match the profile", () => {
    const resume = baseResume({
      experience: [{ ...baseResume().experience[0], company: "Made Up Corp" }],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.message.includes("Company"))).toBe(true);
  });

  it("flags a referee not present in the profile", () => {
    const resume = baseResume({
      referees: [{ name: "Fake Referee", title: "CEO", organisation: "Nowhere Inc", phone: "", email: "" }],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.location.startsWith("Referee"))).toBe(true);
  });

  it("does not flag a project bullet grounded in the confirmed project", () => {
    const resume = baseResume({
      projects: [
        {
          title: "Community Garden Tracker",
          context: "Local volunteer group",
          year: "2023",
          bullets: ["Built a volunteer shift and plot tracker, adopted to replace a shared spreadsheet."],
        },
      ],
    });
    expect(flagUnverifiedFacts(resume, PROFILE)).toEqual([]);
  });

  it("flags a project title that doesn't match the profile's project at that position", () => {
    const resume = baseResume({
      projects: [{ title: "Made Up SaaS Startup", context: "", year: "", bullets: [] }],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.location.startsWith("Project") && f.message.includes("doesn't match your profile"))).toBe(true);
  });

  it("flags a project with no corresponding entry in the profile at all", () => {
    const resume = baseResume({
      projects: [
        {
          title: "Community Garden Tracker",
          context: "Local volunteer group",
          year: "2023",
          bullets: ["Built a volunteer shift and plot tracker, adopted to replace a shared spreadsheet."],
        },
        { title: "Second Made Up Project", context: "", year: "", bullets: [] },
      ],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.location.startsWith("Project #2") && f.message.includes("invented"))).toBe(true);
  });

  it("flags a fabricated metric in a project bullet not present in the profile", () => {
    const resume = baseResume({
      projects: [
        {
          title: "Community Garden Tracker",
          context: "Local volunteer group",
          year: "2023",
          bullets: ["Grew active users by 400% in the first month."],
        },
      ],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.value === "400%")).toBe(true);
  });

  it("does not flag a role reordered relative to the profile", () => {
    const reorderedProfile: UserProfile = {
      ...PROFILE,
      work_experience: [
        {
          job_title: "Data Analyst",
          company: "Coles",
          location: "Melbourne, VIC",
          start_date: "2019",
          end_date: "2022",
          description: "Built dashboards used by regional managers.",
          achievement: "",
      achievement_metric: "",
        },
        PROFILE.work_experience[0],
      ],
    };
    // Resume still lists Woolworths first even though it's second in the profile array.
    expect(flagUnverifiedFacts(baseResume(), reorderedProfile)).toEqual([]);
  });
});

describe("flagRetailorDrift", () => {
  it("returns no flags when retailoring only changes summary/skills", () => {
    const original = baseResume();
    const retailored = baseResume({ summary: "A retailored summary.", skills: ["SQL", "Stakeholder management"] });
    expect(flagRetailorDrift(retailored, original)).toEqual([]);
  });

  it("flags a metric introduced during retailoring that wasn't in the original bullets", () => {
    const original = baseResume();
    const retailored = baseResume({
      experience: [{ ...baseResume().experience[0], bullets: ["Delivered a 90% improvement in throughput."] }],
    });
    const flags = flagRetailorDrift(retailored, original);
    expect(flags.some((f) => f.value === "90%")).toBe(true);
  });

  it("flags dates that changed during retailoring", () => {
    const original = baseResume();
    const retailored = baseResume({
      experience: [{ ...baseResume().experience[0], start_date: "2015" }],
    });
    const flags = flagRetailorDrift(retailored, original);
    expect(flags.some((f) => f.message.includes("Dates"))).toBe(true);
  });

  it("flags a metric introduced into a project bullet during retailoring", () => {
    const original = baseResume({
      projects: [
        { title: "Community Garden Tracker", context: "Local volunteer group", year: "2023", bullets: ["Built a volunteer shift tracker."] },
      ],
    });
    const retailored = baseResume({
      projects: [
        {
          title: "Community Garden Tracker",
          context: "Local volunteer group",
          year: "2023",
          bullets: ["Built a volunteer shift tracker used by 200+ members."],
        },
      ],
    });
    const flags = flagRetailorDrift(retailored, original);
    expect(flags.some((f) => f.value === "200")).toBe(true);
  });
});

describe("flagUnverifiedFacts with a confirmed bridge", () => {
  it("does not flag a number that only appears in an affirmed to_confirm item's user_note", () => {
    const resume = baseResume({
      experience: [
        {
          ...baseResume().experience[0],
          bullets: ["Reconciled takings and resolved discrepancies across 12 tills weekly."],
        },
      ],
    });
    const confirmedBridge: ConfirmedBridge = {
      mode: "pivot",
      items: [
        {
          source_company: "Woolworths Group",
          source_job_title: "Business Analyst",
          competency: "Cash handling and reconciliation",
          target_requirement: "Till reconciliation experience",
          user_note: "Yes, I reconciled takings across 12 tills every week.",
        },
      ],
    };

    const withoutBridge = flagUnverifiedFacts(resume, PROFILE);
    expect(withoutBridge.some((f) => f.value === "12")).toBe(true);

    const withBridge = flagUnverifiedFacts(resume, PROFILE, confirmedBridge);
    expect(withBridge.some((f) => f.value === "12")).toBe(false);
  });

  it("still flags a number unrelated to any confirmed bridge evidence", () => {
    const resume = baseResume({
      experience: [{ ...baseResume().experience[0], bullets: ["Grew the team from 3 to 47 staff."] }],
    });
    const confirmedBridge: ConfirmedBridge = {
      mode: "level_up",
      items: [
        {
          source_company: "Woolworths Group",
          source_job_title: "Business Analyst",
          competency: "Reporting",
          target_requirement: "Stakeholder reporting",
          user_note: null,
        },
      ],
    };
    const flags = flagUnverifiedFacts(resume, PROFILE, confirmedBridge);
    expect(flags.some((f) => f.value === "47")).toBe(true);
  });
});

function bridgeItem(overrides: Partial<SkillsBridgeItem> = {}): SkillsBridgeItem {
  return {
    id: "item-1",
    bridge_id: "bridge-1",
    source_company: "Woolworths Group",
    source_job_title: "Business Analyst",
    source_snippet: "",
    competency: "",
    target_requirement: "",
    state: "to_confirm",
    confidence: "medium",
    user_state: "pending",
    user_note: null,
    ...overrides,
  };
}

describe("flagUnconfirmedBridgeClaims", () => {
  it("returns no flags when no bridge items are given", () => {
    expect(flagUnconfirmedBridgeClaims(baseResume(), [])).toEqual([]);
  });

  it("flags a bullet using language from an unconfirmed item's target_requirement", () => {
    const resume = baseResume({
      experience: [
        {
          ...baseResume().experience[0],
          bullets: ["Managed rostering and scheduling for a team of casual staff."],
        },
      ],
    });
    const items = [
      bridgeItem({
        id: "gap-1",
        state: "gap",
        user_state: "pending",
        target_requirement: "Rostering and scheduling experience",
      }),
    ];
    const flags = flagUnconfirmedBridgeClaims(resume, items);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].location).toContain("bullet 1");
  });

  it("does not flag language covered by a confirmed item", () => {
    const resume = baseResume({
      experience: [
        {
          ...baseResume().experience[0],
          bullets: ["Managed rostering and scheduling for a team of casual staff."],
        },
      ],
    });
    const items = [
      bridgeItem({
        id: "confirmed-1",
        state: "to_confirm",
        user_state: "confirmed",
        competency: "Rostering and scheduling",
        target_requirement: "Rostering and scheduling experience",
      }),
    ];
    expect(flagUnconfirmedBridgeClaims(resume, items)).toEqual([]);
  });

  it("does not flag a rejected item's language once it's rejected and unrelated to the bullet", () => {
    const resume = baseResume();
    const items = [bridgeItem({ id: "rejected-1", state: "to_confirm", user_state: "rejected", target_requirement: "Forklift licence" })];
    expect(flagUnconfirmedBridgeClaims(resume, items)).toEqual([]);
  });

  it("flags a Tools & Platforms entry left over from a still-pending item (never answered Yes/Not really)", () => {
    const resume = baseResume({ tools: ["Data & BI: Power BI, Excel"] });
    const items = [
      bridgeItem({
        id: "to-confirm-1",
        state: "to_confirm",
        user_state: "pending",
        target_requirement: "Power BI dashboard experience",
      }),
    ];
    const flags = flagUnconfirmedBridgeClaims(resume, items);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].location).toContain("Tools & Platforms");
  });

  it("flags a Key Skills entry tied to an unconfirmed item", () => {
    const resume = baseResume({ skills: ["Power BI dashboarding"] });
    const items = [
      bridgeItem({
        id: "to-confirm-2",
        state: "to_confirm",
        user_state: "pending",
        target_requirement: "Power BI dashboarding",
      }),
    ];
    const flags = flagUnconfirmedBridgeClaims(resume, items);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].location).toContain("Key Skills");
  });

  it("does not flag a Tools & Platforms entry once the matching item is confirmed", () => {
    const resume = baseResume({ tools: ["Data & BI: Power BI, Excel"] });
    const items = [
      bridgeItem({
        id: "confirmed-2",
        state: "to_confirm",
        user_state: "confirmed",
        competency: "Power BI",
        target_requirement: "Power BI dashboard experience",
      }),
    ];
    expect(flagUnconfirmedBridgeClaims(resume, items)).toEqual([]);
  });
});

describe("buildConfirmedBridge", () => {
  it("returns undefined when nothing is confirmed", () => {
    const items = [
      bridgeItem({ id: "1", state: "to_confirm", user_state: "pending" }),
      bridgeItem({ id: "2", state: "gap", user_state: "pending" }),
    ];
    expect(buildConfirmedBridge("pivot", items)).toBeUndefined();
  });

  it("includes a pre-confirmed matched item and an affirmed to_confirm item, excludes a rejected one", () => {
    const items = [
      bridgeItem({ id: "matched-1", state: "matched", user_state: "confirmed", competency: "Rostering" }),
      bridgeItem({ id: "confirmed-1", state: "to_confirm", user_state: "confirmed", competency: "KPI reporting" }),
      bridgeItem({ id: "rejected-1", state: "matched", user_state: "rejected", competency: "Should not appear" }),
    ];
    const bridge = buildConfirmedBridge("pivot", items);
    expect(bridge?.items.map((i) => i.competency).sort()).toEqual(["KPI reporting", "Rostering"]);
  });

  it("never includes a gap item, even if one somehow had user_state='confirmed'", () => {
    // Defensive: the PATCH route already refuses to confirm a gap item (see
    // app/api/skills-bridge/[bridgeId]/items/[itemId]/route.ts), but this asserts the same
    // invariant holds here too, independent of that route-level check ever existing/working.
    const items = [bridgeItem({ id: "gap-1", state: "gap", user_state: "confirmed", competency: "Should not appear" })];
    const bridge = buildConfirmedBridge("pivot", items);
    expect(bridge).toBeUndefined();
  });

  it("carries the mode through unchanged", () => {
    const items = [bridgeItem({ id: "1", state: "matched", user_state: "confirmed" })];
    expect(buildConfirmedBridge("level_up", items)?.mode).toBe("level_up");
  });
});

describe("anchorBridgeItem", () => {
  it("leaves a matched item alone when its source resolves to a real job", () => {
    const item = {
      source_company: "Woolworths Group",
      source_job_title: "Business Analyst",
      source_snippet: "quote",
      competency: "Reporting",
      target_requirement: "Stakeholder reporting",
      state: "matched" as const,
      confidence: "high" as const,
    };
    expect(anchorBridgeItem(item, PROFILE)).toEqual(item);
  });

  it("corrects a fabricated job title to the real one when the company matches but the title doesn't", () => {
    // Regression: the model can anchor to a real company while inventing an unrelated job title
    // at that company (e.g. claiming "Barista" at a company where the candidate's real title was
    // something else entirely). The company-only fallback in findSourceExperience resolves this
    // as "anchored," so the fabricated title must be overwritten with the real one, never left as
    // the model wrote it.
    const item = {
      source_company: "Woolworths Group",
      source_job_title: "Barista",
      source_snippet: "quote",
      competency: "Customer service",
      target_requirement: "Front-of-house experience",
      state: "matched" as const,
      confidence: "high" as const,
    };
    const result = anchorBridgeItem(item, PROFILE);
    expect(result.state).toBe("matched");
    expect(result.source_company).toBe("Woolworths Group");
    expect(result.source_job_title).toBe("Business Analyst");
    expect(result.source_job_title).not.toBe("Barista");
  });

  it("downgrades a matched item to gap when its source company doesn't exist in the profile", () => {
    const item = {
      source_company: "Made Up Corp",
      source_job_title: "Business Analyst",
      source_snippet: "quote",
      competency: "Reporting",
      target_requirement: "Stakeholder reporting",
      state: "matched" as const,
      confidence: "high" as const,
    };
    const result = anchorBridgeItem(item, PROFILE);
    expect(result.state).toBe("gap");
    expect(result.source_company).toBe("");
    expect(result.source_job_title).toBe("");
  });

  it("always clears source fields on a gap item, even if the model attached one", () => {
    const item = {
      source_company: "Woolworths Group",
      source_job_title: "Business Analyst",
      source_snippet: "quote",
      competency: "Something missing",
      target_requirement: "Some target skill",
      state: "gap" as const,
      confidence: "high" as const,
    };
    const result = anchorBridgeItem(item, PROFILE);
    expect(result.source_company).toBe("");
    expect(result.source_job_title).toBe("");
  });
});

function dutySuggestion(overrides: Partial<RoleDutySuggestion> = {}): RoleDutySuggestion {
  return {
    id: "suggestion-1",
    user_id: "u1",
    job_title: "business analyst",
    created_at: "2024-01-01",
    ...overrides,
  };
}

function dutyItem(overrides: Partial<RoleDutyItem> = {}): RoleDutyItem {
  return {
    id: "item-1",
    suggestion_id: "suggestion-1",
    duty_text: "",
    user_edited_text: null,
    user_state: "pending",
    outcome_text: null,
    outcome_metric: null,
    ...overrides,
  };
}

describe("buildConfirmedRoleDuties", () => {
  it("returns nothing when no items are confirmed", () => {
    const items = [dutyItem({ user_state: "pending" }), dutyItem({ id: "2", user_state: "rejected" })];
    expect(buildConfirmedRoleDuties([dutySuggestion()], items, PROFILE.work_experience)).toEqual([]);
  });

  it("includes only confirmed items and resolves the real-cased job title from the profile", () => {
    const items = [
      dutyItem({ id: "1", user_state: "confirmed", duty_text: "Reconciled monthly reports" }),
      dutyItem({ id: "2", user_state: "rejected", duty_text: "Should not appear" }),
    ];
    const duties = buildConfirmedRoleDuties([dutySuggestion()], items, PROFILE.work_experience);
    expect(duties).toEqual([{ job_title: "Business Analyst", duty_text: "Reconciled monthly reports" }]);
  });

  it("prefers user_edited_text over duty_text when a confirmed item has been edited", () => {
    const items = [
      dutyItem({ id: "1", user_state: "confirmed", duty_text: "Reconciled monthly reports", user_edited_text: "Reconciled quarterly reports" }),
    ];
    const duties = buildConfirmedRoleDuties([dutySuggestion()], items, PROFILE.work_experience);
    expect(duties).toEqual([{ job_title: "Business Analyst", duty_text: "Reconciled quarterly reports" }]);
  });

  it("falls back to the normalized title when no matching profile entry exists", () => {
    const items = [dutyItem({ user_state: "confirmed", duty_text: "Did stuff" })];
    const duties = buildConfirmedRoleDuties(
      [dutySuggestion({ job_title: "warehouse picker" })],
      items,
      PROFILE.work_experience
    );
    expect(duties).toEqual([{ job_title: "warehouse picker", duty_text: "Did stuff" }]);
  });

  it("drops an item whose suggestion_id doesn't resolve to any suggestion", () => {
    const items = [dutyItem({ suggestion_id: "missing-suggestion", user_state: "confirmed" })];
    expect(buildConfirmedRoleDuties([dutySuggestion()], items, PROFILE.work_experience)).toEqual([]);
  });

  it("carries a confirmed item's captured outcome_text and outcome_metric through", () => {
    const items = [
      dutyItem({
        id: "1",
        user_state: "confirmed",
        duty_text: "Reconciled monthly reports",
        outcome_text: "Caught errors before month-end close",
        outcome_metric: "15% fewer discrepancies",
      }),
    ];
    const duties = buildConfirmedRoleDuties([dutySuggestion()], items, PROFILE.work_experience);
    expect(duties).toEqual([
      {
        job_title: "Business Analyst",
        duty_text: "Reconciled monthly reports",
        outcome_text: "Caught errors before month-end close",
        outcome_metric: "15% fewer discrepancies",
      },
    ]);
  });

  it("omits outcome_text/outcome_metric entirely when the candidate captured no impact", () => {
    const items = [dutyItem({ id: "1", user_state: "confirmed", duty_text: "Reconciled monthly reports" })];
    const duties = buildConfirmedRoleDuties([dutySuggestion()], items, PROFILE.work_experience);
    expect(duties).toEqual([{ job_title: "Business Analyst", duty_text: "Reconciled monthly reports" }]);
  });
});

describe("flagUnverifiedFacts with confirmed role duties", () => {
  it("does not flag a number that only appears in a confirmed duty's text", () => {
    const resume = baseResume({
      experience: [
        {
          ...baseResume().experience[0],
          bullets: ["Reconciled reporting discrepancies across 12 business units monthly."],
        },
      ],
    });
    const confirmedRoleDuties: ConfirmedRoleDuty[] = [
      { job_title: "Business Analyst", duty_text: "Reconciled reporting discrepancies across 12 business units monthly." },
    ];

    const withoutDuties = flagUnverifiedFacts(resume, PROFILE);
    expect(withoutDuties.some((f) => f.value === "12")).toBe(true);

    const withDuties = flagUnverifiedFacts(resume, PROFILE, undefined, confirmedRoleDuties);
    expect(withDuties.some((f) => f.value === "12")).toBe(false);
  });

  it("does not apply a confirmed duty from a different job title to this role", () => {
    const resume = baseResume({
      experience: [{ ...baseResume().experience[0], bullets: ["Managed a fleet of 30 delivery vehicles."] }],
    });
    const confirmedRoleDuties: ConfirmedRoleDuty[] = [
      { job_title: "Logistics Coordinator", duty_text: "Managed a fleet of 30 delivery vehicles." },
    ];
    const flags = flagUnverifiedFacts(resume, PROFILE, undefined, confirmedRoleDuties);
    expect(flags.some((f) => f.value === "30")).toBe(true);
  });

  it("does not flag a number that only appears in a confirmed duty's captured outcome_metric", () => {
    const resume = baseResume({
      experience: [
        {
          ...baseResume().experience[0],
          bullets: ["Reconciled monthly reports, cutting discrepancies by 15%."],
        },
      ],
    });
    const confirmedRoleDuties: ConfirmedRoleDuty[] = [
      {
        job_title: "Business Analyst",
        duty_text: "Reconciled monthly reports",
        outcome_text: "Cut discrepancies",
        outcome_metric: "15%",
      },
    ];

    const withoutDuties = flagUnverifiedFacts(resume, PROFILE);
    expect(withoutDuties.some((f) => f.value === "15%")).toBe(true);

    const withDuties = flagUnverifiedFacts(resume, PROFILE, undefined, confirmedRoleDuties);
    expect(withDuties.some((f) => f.value === "15%")).toBe(false);
  });
});
