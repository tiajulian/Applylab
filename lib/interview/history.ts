import { cleanCompanyName } from "@/lib/applications/jobListing";
import { familyAverages, overallAverage } from "@/lib/interview/rubrics";
import { overallToFive } from "@/lib/interview/scoreLabels";
import { practiceJobKey, sessionJob } from "@/lib/interview/uploadedResume";
import type { InterviewEndedReason, InterviewMode, InterviewPressureLevel, InterviewSessionStatus, InterviewStageType, InterviewTurn, StarPart } from "@/types";

export type HistoryStatus = "finished" | "in_progress" | "ended_early";

export interface HistorySessionRow {
  id: string;
  created_at: string;
  stage_type: InterviewStageType;
  pressure_level: InterviewPressureLevel | null;
  status: InterviewSessionStatus;
  ended_reason: InterviewEndedReason | null;
  overall_score: number | null;
  mode: InterviewMode;
  resume_id: string | null;
  uploaded_resume_id?: string | null;
  job_title?: string | null;
  company_name?: string | null;
  job_description?: string | null;
  application_id?: string | null;
  application_interview_id?: string | null;
  resumes?: { job_title: string | null; company_name: string | null } | null;
}

export type ProgressSessionRow = Pick<HistorySessionRow, "id" | "created_at" | "mode" | "resume_id" | "uploaded_resume_id" | "job_title" | "company_name">;

export interface HistoryItem {
  id: string;
  createdAt: string;
  jobTitle: string;
  company: string | null;
  stageType: InterviewStageType;
  pressureLevel: InterviewPressureLevel;
  status: HistoryStatus;
  /** 1-5; null for coaching sessions and anything without a finished report. */
  score: number | null;
  coaching: boolean;
  /** Something to open: a live session or a report. Closed with nothing answered: no. */
  canOpen: boolean;
}

export function historyStatus(row: Pick<HistorySessionRow, "status" | "ended_reason">): HistoryStatus {
  if (row.status === "in_progress") return "in_progress";
  if (row.status === "abandoned" || row.ended_reason === "ended_early") return "ended_early";
  return "finished";
}

export function toHistoryItem(row: HistorySessionRow): HistoryItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    jobTitle: sessionJob(row).jobTitle || "Interview practice",
    company: cleanCompanyName(sessionJob(row).companyName) || null,
    stageType: row.stage_type,
    pressureLevel: row.pressure_level ?? "realistic",
    status: historyStatus(row),
    score: row.mode === "coaching" || row.overall_score === null ? null : overallToFive(row.overall_score),
    coaching: row.mode === "coaching",
    canOpen: row.status !== "abandoned",
  };
}

type ScoredTurn = Pick<InterviewTurn, "session_id" | "rubric" | "question_type" | "star_scores" | "rubric_scores" | "score_reasons">;

export interface ProgressPoint {
  sessionId: string;
  /** practiceJobKey: sessions for the same job share it. */
  jobKey: string;
  date: string;
  /** Mean of first-try question averages, 1-5. */
  overall: number;
  /** First-try STAR part averages, when the session had STAR questions. */
  parts: Record<StarPart, number> | null;
}

/**
 * One point per scored session, oldest first, from FIRST tries only (the turn rows themselves,
 * never the retries), which is the honest measure of readiness. Coaching sessions never appear.
 */
export function progressPoints(
  sessions: ProgressSessionRow[],
  turns: ScoredTurn[]
): ProgressPoint[] {
  const bySession = new Map<string, ScoredTurn[]>();
  for (const t of turns) {
    const list = bySession.get(t.session_id);
    if (list) list.push(t);
    else bySession.set(t.session_id, [t]);
  }
  const points: ProgressPoint[] = [];
  for (const s of sessions) {
    if (s.mode === "coaching") continue;
    const sessionTurns = bySession.get(s.id) ?? [];
    const overall = overallAverage(sessionTurns);
    if (overall === null) continue;
    const star = familyAverages(sessionTurns).star;
    const parts =
      star && ["situation", "task", "action", "result"].every((k) => typeof star[k] === "number")
        ? (star as Record<StarPart, number>)
        : null;
    points.push({ sessionId: s.id, jobKey: practiceJobKey(s), date: s.created_at, overall, parts });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

const PART_LABELS: Record<StarPart, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };

export interface PartInsight {
  part: StarPart;
  label: string;
  count: number;
  of: number;
}

/** "Result is your lowest score in 4 of your last 5 sessions." Only said when it's a pattern
 *  (3 or more of the last 5); ties for lowest don't count towards any part. */
export function lowestPartInsight(points: ProgressPoint[]): PartInsight | null {
  const recent = points.filter((p) => p.parts).slice(-5);
  if (recent.length < 3) return null;
  const counts = new Map<StarPart, number>();
  for (const p of recent) {
    const entries = Object.entries(p.parts!) as [StarPart, number][];
    const min = Math.min(...entries.map(([, v]) => v));
    const lowest = entries.filter(([, v]) => v === min);
    if (lowest.length === 1) counts.set(lowest[0][0], (counts.get(lowest[0][0]) ?? 0) + 1);
  }
  const [part, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return part && count && count >= 3 ? { part, label: PART_LABELS[part], count, of: recent.length } : null;
}

export interface PracticeSummary {
  count: number;
  lastAt: string;
  /** 1-5, from the latest finished practice that has a score. */
  lastScore: number | null;
  lastSessionId: string;
  /** Lowest STAR part across this practice's latest report, if any. */
  weakestPart: string | null;
}

type SummaryRow = {
  id: string;
  created_at: string;
  overall_score: number | null;
  star_averages?: Partial<Record<StarPart, number>> | null;
};

const weakest = (avgs: SummaryRow["star_averages"]): string | null => {
  if (!avgs) return null;
  const entries = (Object.entries(avgs) as [StarPart, number][]).filter(([, v]) => typeof v === "number");
  if (entries.length === 0) return null;
  return PART_LABELS[entries.sort((a, b) => a[1] - b[1])[0][0]];
};

/** "Practised 2 times · last on 14 Oct · 3.6", grouped by any key (application or round). */
export function practiceSummaries<T extends SummaryRow>(rows: T[], keyOf: (row: T) => string | null | undefined): Map<string, PracticeSummary> {
  const out = new Map<string, PracticeSummary>();
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const row of sorted) {
    const key = keyOf(row);
    if (!key) continue;
    const score = row.overall_score === null ? null : overallToFive(row.overall_score);
    const existing = out.get(key);
    if (existing) {
      existing.count += 1;
      // Newest first, so the first score / weak part found is the latest one that has it.
      existing.lastScore ??= score;
      existing.weakestPart ??= weakest(row.star_averages);
      continue;
    }
    out.set(key, {
      count: 1,
      lastAt: row.created_at,
      lastScore: score,
      lastSessionId: row.id,
      weakestPart: weakest(row.star_averages),
    });
  }
  return out;
}

