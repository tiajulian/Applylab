import { describe, it, expect, vi } from "vitest";
import { bestAttemptTurns } from "./attempts";
import { scoreLabel, starAverage, overallToFive, hasWeakPart } from "./scoreLabels";
import { buildHonestyContext, enforceHonesty, newClaims, replaceClaims } from "./honesty";
import { quotesToSpans, repeatedWords, safeSpans, topFillers } from "./spans";
import { buildEvidence, resolveSources } from "./evidence";
import type { InterviewTurn, InterviewTurnAttempt, StarScores } from "@/types";

const star = (s: number, t: number, a: number, r: number): StarScores => ({ situation: s, task: t, action: a, result: r, summary: "" });

function turn(id: string, scores: StarScores | null, extra: Partial<InterviewTurn> = {}): InterviewTurn {
  return {
    id,
    session_id: "s1",
    order_index: 1,
    question_type: "behavioural",
    question_text: "Q",
    is_followup: false,
    parent_turn_id: null,
    transcript: "first answer",
    answer_source: "text",
    duration_sec: null,
    wpm: null,
    filler_count: 0,
    star_scores: scores,
    content_feedback: null,
    delivery_feedback: null,
    suggested_answer: null,
    audio_url: null,
    created_at: "",
    ...extra,
  };
}

function attempt(turnId: string, n: number, scores: StarScores, transcript: string): InterviewTurnAttempt {
  return {
    id: `${turnId}-${n}`,
    turn_id: turnId,
    session_id: "s1",
    user_id: "u1",
    attempt_number: n,
    transcript,
    answer_source: "text",
    duration_sec: null,
    wpm: null,
    filler_count: 0,
    star_scores: scores,
    score_reasons: null,
    biggest_fix: null,
    what_worked: null,
    transcript_spans: null,
    content_feedback: null,
    delivery_feedback: null,
    suggested_answer: null,
    suggested_answer_sources: null,
    submission_id: null,
    created_at: "",
  };
}

describe("score labels", () => {
  it("uses the agreed bands", () => {
    expect(scoreLabel(2.4).label).toBe("Needs work");
    expect(scoreLabel(2.5).label).toBe("Getting there");
    expect(scoreLabel(3.4).label).toBe("Getting there");
    expect(scoreLabel(3.5).label).toBe("Interview-ready");
    expect(scoreLabel(4.2).label).toBe("Interview-ready");
    expect(scoreLabel(4.3).label).toBe("Strong");
  });

  it("converts the stored 0-100 overall score back to the 1-5 scale", () => {
    expect(overallToFive(75)).toBe(3.8);
    expect(starAverage(star(4, 4, 3, 2))).toBe(3.3);
  });

  it("flags any part at 2 or below as worth another try", () => {
    expect(hasWeakPart(star(4, 4, 4, 2))).toBe(true);
    expect(hasWeakPart(star(3, 3, 3, 3))).toBe(false);
  });
});

describe("bestAttemptTurns", () => {
  it("uses the best try for the headline and leaves the first try on the turn", () => {
    const t = turn("t1", star(2, 2, 2, 1));
    const out = bestAttemptTurns([t], [attempt("t1", 2, star(4, 4, 4, 4), "better"), attempt("t1", 3, star(3, 3, 3, 3), "worse")]);
    expect(out[0].star_scores).toEqual(star(4, 4, 4, 4));
    expect(out[0].transcript).toBe("better");
    expect(t.star_scores).toEqual(star(2, 2, 2, 1));
  });

  it("keeps the first try when no retry beat it", () => {
    const t = turn("t1", star(4, 4, 4, 4));
    expect(bestAttemptTurns([t], [attempt("t1", 2, star(3, 3, 3, 3), "x")])[0]).toBe(t);
  });
});

describe("honesty check", () => {
  const ctx = buildHonestyContext([{ work_experience: [{ company: "Telstra", description: "Cut the backlog by 40 percent using Microsoft Excel" }] }, "I used Jira daily"]);

  it("finds numbers and tools the candidate never logged or said", () => {
    const claims = newClaims("I cut the backlog by 65% using Snowflake and Excel.", ctx);
    expect(claims.map((c) => c.text)).toEqual(["65%", "Snowflake"]);
  });

  it("treats '40 percent' as backing '40%', and the transcript as the candidate's own words", () => {
    expect(newClaims("Cut the backlog by 40% in Jira.", ctx)).toEqual([]);
  });

  it("replaces leftovers with visible placeholders", () => {
    const text = "Grew sales 65% with Snowflake.";
    expect(replaceClaims(text, newClaims(text, ctx))).toBe("Grew sales [your real number] with [your real tool].");
  });

  it("rewrites once, then placeholders anything still there, and drops an inventing follow-up", async () => {
    const rewrite = vi.fn().mockResolvedValue("Grew sales 65% in my team.");
    const out = await enforceHonesty(
      {
        suggestedAnswer: "Grew sales 65% with Snowflake.",
        followupQuestion: "How did you configure Tableau?",
        questionText: "Tell me about a result.",
      },
      ctx,
      rewrite
    );
    expect(rewrite).toHaveBeenCalledWith("Grew sales 65% with Snowflake.", ["65%", "Snowflake"]);
    expect(out.suggestedAnswer).toBe("Grew sales [your real number] in my team.");
    expect(out.followupQuestion).toBeNull();
    expect(out.claimTypes.sort()).toEqual(["number", "tool"]);
  });

  it("doesn't mistake everyday words for tools", () => {
    expect(newClaims("Before we could go live, I had to zoom out and square it with the team.", ctx)).toEqual([]);
  });

  it("flags an employer the candidate never mentioned, but not one they did", () => {
    const claims = newClaims("When I was at Atlassian I worked with Finance. Later at Telstra I led the team.", ctx);
    expect(claims.map((c) => [c.text, c.type])).toEqual([["Atlassian", "employer"]]);
    expect(replaceClaims("I was at Atlassian.", claims.map((c) => ({ ...c, start: 9, end: 18 })))).toBe("I was at [your real employer].");
  });

  it("lets a follow-up repeat a tool the question itself asked about", async () => {
    const out = await enforceHonesty(
      { suggestedAnswer: "", followupQuestion: "What would you need to learn in Tableau?", questionText: "This role uses Tableau. How would you get up to speed?" },
      ctx,
      vi.fn()
    );
    expect(out.followupQuestion).toBe("What would you need to learn in Tableau?");
  });
});

describe("transcript spans and word patterns", () => {
  const transcript = "Last year our team was behind. I rebuilt the triage queue myself. The backlog dropped and basically, basically, basically it worked.";

  it("turns quoted words into offsets and drops quotes that aren't in the transcript", () => {
    const spans = quotesToSpans(transcript, [
      { part: "situation", quote: "our team was behind" },
      { part: "action", quote: "I rebuilt the triage queue" },
      { part: "result", quote: "something never said" },
      { part: "nonsense", quote: "Last year" },
    ]);
    expect(spans.map((s) => s.part)).toEqual(["situation", "action"]);
    expect(transcript.slice(spans[1].start, spans[1].end)).toBe("I rebuilt the triage queue");
  });

  it("re-validates stored spans before rendering", () => {
    expect(safeSpans("short", [{ start: 0, end: 50, part: "task" }])).toEqual([]);
  });

  it("finds repeated words and top fillers", () => {
    expect(repeatedWords(transcript)).toEqual([{ word: "basically", count: 3 }]);
    expect(topFillers("um um, so like, um basically")).toEqual([
      { word: "um", count: 3 },
      { word: "like", count: 1 },
      { word: "basically", count: 1 },
    ]);
  });
});

describe("evidence ids", () => {
  it("gives roles, wins and projects stable ids and drops unknown sources", () => {
    const items = buildEvidence({
      work_experience: [
        { job_title: "Customer Ops Lead", company: "Telstra", location: "", start_date: "", end_date: "", is_current: true, description: "", wins: [{ text: "Cut ticket backlog 30%", metric: "30%" }] },
      ],
      projects: [],
    });
    expect(items.map((i) => i.id)).toEqual(["role:0", "win:0:0"]);
    expect(resolveSources(["win:0:0", "role:9", "role:0", "win:0:0"], items)).toEqual([
      { id: "win:0:0", label: "Win: Cut ticket backlog 30%" },
      { id: "role:0", label: "Customer Ops Lead at Telstra" },
    ]);
  });
});
