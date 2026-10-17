import type { InterviewRubric, InterviewTurn, RubricScores, StarScores } from "@/types";

/** Part averages are reported per family; "technical" stories are marked on STAR too. */
export type RubricFamily = "star" | "motivation" | "gap";

export interface RubricPart {
  key: string;
  label: string;
}

export interface RubricDefinition {
  /** Plain words for the feedback header, e.g. "Motivation question". */
  kind: string;
  /** "marked on ..." */
  markedOn: string;
  family: RubricFamily | null;
  parts: RubricPart[];
}

const STAR_PARTS: RubricPart[] = [
  { key: "situation", label: "Situation" },
  { key: "task", label: "Task" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
];

export const RUBRICS: Record<InterviewRubric, RubricDefinition> = {
  star: { kind: "Experience question", markedOn: "Situation, Task, Action and Result", family: "star", parts: STAR_PARTS },
  technical: { kind: "Skills question", markedOn: "Situation, Task, Action and Result", family: "star", parts: STAR_PARTS },
  motivation: {
    kind: "Motivation question",
    markedOn: "relevance, reasons, structure and length",
    family: "motivation",
    parts: [
      { key: "relevance", label: "Relevance to this role" },
      { key: "reasons", label: "Specific reasons" },
      { key: "structure", label: "Clear structure" },
      { key: "length", label: "Length" },
    ],
  },
  gap: {
    kind: "Honest gap question",
    markedOn: "honesty, bridge and plan",
    family: "gap",
    parts: [
      { key: "honesty", label: "Honesty" },
      { key: "bridge", label: "Bridge to related experience" },
      { key: "plan", label: "Plan to close it" },
    ],
  },
  coding: { kind: "Coding question", markedOn: "approach, correctness and complexity", family: null, parts: [] },
};

export const FAMILY_LABELS: Record<RubricFamily, string> = {
  star: "Experience questions (STAR)",
  motivation: "Motivation questions",
  gap: "Honest gap questions",
};

/** The question writer's question_type decides the marking; nothing is left to a second guess. */
export function rubricForQuestionType(questionType: string): InterviewRubric | null {
  switch (questionType) {
    case "motivation":
      return "motivation";
    case "gap":
      return "gap";
    case "technical":
      return "technical";
    case "coding":
    case "sql":
      return "coding";
    case "group_coaching":
      return null;
    default:
      return "star";
  }
}

/** A turn's rubric: stored on the turn, or derived for turns made before it was stored. */
export function rubricOf(turn: Pick<InterviewTurn, "rubric" | "question_type">): InterviewRubric | null {
  return turn.rubric ?? rubricForQuestionType(turn.question_type);
}

export interface ScoredPart extends RubricPart {
  score: number;
  reason?: string;
}

export interface TurnScores {
  rubric: InterviewRubric;
  definition: RubricDefinition;
  parts: ScoredPart[];
  average: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Scores for one part list from either STAR scores or rubric scores; null if any part is missing. */
function scoredParts(
  parts: RubricPart[],
  values: StarScores | RubricScores | null | undefined,
  reasons?: Record<string, string> | null
): ScoredPart[] | null {
  if (!values || parts.length === 0) return null;
  const out: ScoredPart[] = [];
  for (const p of parts) {
    const v = Number((values as Record<string, unknown>)[p.key]);
    if (!Number.isFinite(v)) return null;
    out.push({ ...p, score: v, reason: reasons?.[p.key] || undefined });
  }
  return out;
}

/** The marked parts and average of an answered turn (or a try merged over it); null for
 *  coaching-only answers, which never get a number. */
export function turnScores(
  turn: Pick<InterviewTurn, "rubric" | "question_type" | "star_scores" | "rubric_scores" | "score_reasons">
): TurnScores | null {
  let rubric = rubricOf(turn);
  if (!rubric) return null;
  // Answers scored before rubrics were stored were all marked on STAR, motivation and gap ones
  // included; read those the way they were scored rather than finding no score at all.
  if (!turn.rubric && (rubric === "motivation" || rubric === "gap") && turn.star_scores && !turn.rubric_scores) {
    rubric = "star";
  }
  const definition = RUBRICS[rubric];
  if (!definition.family) return null;
  const values = definition.family === "star" ? turn.star_scores : turn.rubric_scores;
  const parts = scoredParts(definition.parts, values, turn.score_reasons);
  if (!parts) return null;
  return { rubric, definition, parts, average: round1(parts.reduce((sum, p) => sum + p.score, 0) / parts.length) };
}

export const turnAverage = (turn: Parameters<typeof turnScores>[0]): number | null => turnScores(turn)?.average ?? null;

/** The part that plays the role of "Result" in each rubric: what the Gentle tone follows up on. */
const OUTCOME_PART: Record<RubricFamily, string> = { star: "result", motivation: "reasons", gap: "plan" };

/** What the follow-up rules need, for any rubric: the outcome part's score, and the weakest of
 *  the parts a Tough interviewer probes (Action and Result for STAR, every part otherwise). */
export function followupSignals(scores: TurnScores | null): { outcomeScore: number | null; weakestScore: number | null } {
  if (!scores?.definition.family) return { outcomeScore: null, weakestScore: null };
  const byKey = new Map(scores.parts.map((p) => [p.key, p.score]));
  const probed = scores.definition.family === "star" ? ["action", "result"] : scores.parts.map((p) => p.key);
  const probedScores = probed.map((k) => byKey.get(k)).filter((v): v is number => typeof v === "number");
  return {
    outcomeScore: byKey.get(OUTCOME_PART[scores.definition.family]) ?? null,
    weakestScore: probedScores.length ? Math.min(...probedScores) : null,
  };
}

/** Any part at 2 or below: the answer is worth another try before moving on. */
export const hasWeakScoredPart = (scores: TurnScores | null) => Boolean(scores?.parts.some((p) => p.score <= 2));

/** Per-family part averages across turns, never mixing families. */
export function familyAverages(turns: Parameters<typeof turnScores>[0][]): Partial<Record<RubricFamily, Record<string, number>>> {
  const sums: Partial<Record<RubricFamily, Record<string, { total: number; n: number }>>> = {};
  for (const t of turns) {
    const s = turnScores(t);
    if (!s?.definition.family) continue;
    const fam = (sums[s.definition.family] ??= {});
    for (const p of s.parts) {
      const cell = (fam[p.key] ??= { total: 0, n: 0 });
      cell.total += p.score;
      cell.n += 1;
    }
  }
  const out: Partial<Record<RubricFamily, Record<string, number>>> = {};
  for (const [fam, parts] of Object.entries(sums) as [RubricFamily, Record<string, { total: number; n: number }>][]) {
    out[fam] = Object.fromEntries(Object.entries(parts).map(([k, c]) => [k, round1(c.total / c.n)]));
  }
  return out;
}

/** Mean of answered questions' averages (any rubric), 1-5; null when nothing was scored. */
export function overallAverage(turns: Parameters<typeof turnScores>[0][]): number | null {
  const avgs = turns.map(turnAverage).filter((a): a is number => a !== null);
  return avgs.length ? round1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
}
