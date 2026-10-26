import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { bestAttemptTurns } from "@/lib/interview/attempts";
import { STAGES } from "@/lib/interview/setupConstants";
import { overallToFive, scoreLabel } from "@/lib/interview/scoreLabels";
import { FAMILY_LABELS, RUBRICS, turnAverage, type RubricFamily } from "@/lib/interview/rubrics";
import { sessionJob } from "@/lib/interview/uploadedResume";
import { PrintOnLoad } from "./PrintOnLoad";
import type { InterviewSession, InterviewTurn, InterviewTurnAttempt, Resume } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interview practice report", robots: { index: false } };

/**
 * Printable report ("Download PDF"): the browser's print dialog saves it as a PDF, so there is no
 * server PDF cost. Outside the dashboard layout so no navigation ends up on the page.
 */
export default async function InterviewReportPrintPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const [{ data: sessionRow }, { data: turnRows }, { data: attemptRows }] = await Promise.all([
    supabase
      .from("interview_sessions")
      .select("*, resumes(job_title, company_name)")
      .eq("id", params.id)
      .eq("user_id", user.authUserId)
      .single(),
    supabase.from("interview_turns").select("*").eq("session_id", params.id).order("order_index", { ascending: true }),
    supabase.from("interview_turn_attempts").select("*").eq("session_id", params.id),
  ]);

  const session = sessionRow as (InterviewSession & { resumes: Pick<Resume, "job_title" | "company_name"> | null }) | null;
  if (!session || !session.report) redirect(`/interview/${params.id}`);

  const report = session.report;
  const turns = bestAttemptTurns((turnRows || []) as InterviewTurn[], (attemptRows || []) as InterviewTurnAttempt[]);
  const byId = new Map(turns.map((t) => [t.id, t]));
  const stageTitle = STAGES.find((s) => s.type === session.stage_type)?.title ?? "Interview";
  const overall = report.overall_score !== null ? overallToFive(report.overall_score) : null;
  const families = Object.entries(report.rubric_averages ?? (report.star_averages ? { star: report.star_averages } : {})) as [
    RubricFamily,
    Record<string, number>,
  ][];

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-[13px] leading-relaxed text-ink print:px-0 print:py-0">
      <PrintOnLoad />
      <header className="border-b border-border pb-4">
        <p className="text-xs text-ink-muted">ApplyLab interview practice report</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">
          {[sessionJob(session).jobTitle, sessionJob(session).companyName].filter(Boolean).join(" · ") || "Interview practice"}
        </h1>
        <p className="mt-1 text-xs text-ink-secondary">
          {stageTitle} · {new Date(session.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        {overall !== null && (
          <p className="mt-3 text-lg font-semibold">
            {scoreLabel(overall).label} · {overall.toFixed(1)} out of 5
          </p>
        )}
      </header>

      {families.length > 0 && (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-sm font-semibold">Scores by part</h2>
          {families.map(([fam, avgs]) => (
            <p key={fam} className="mt-1">
              {families.length > 1 && <span className="font-medium">{FAMILY_LABELS[fam]}: </span>}
              {RUBRICS[fam].parts
                .filter((p) => typeof avgs[p.key] === "number")
                .map((p) => `${p.label} ${avgs[p.key]}`)
                .join(" · ")}
            </p>
          ))}
        </section>
      )}

      <section className="mt-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold">Question by question</h2>
        {report.question_summaries.map((s, i) => {
          const turn = s.turn_id ? byId.get(s.turn_id) : undefined;
          return (
            <article key={s.turn_id ?? i} className="break-inside-avoid border-t border-border pt-3">
              <h3 className="font-semibold">
                {i + 1}. {s.question_text.replace(/^\[(.*?)\]\s*/, "")}
              </h3>
              {s.skipped ? (
                <p className="mt-1 text-ink-muted">Skipped</p>
              ) : (
                <>
                  {turn && turnAverage(turn) !== null && (
                    <p className="mt-1 text-xs text-ink-secondary">
                      {scoreLabel(turnAverage(turn)!).label} · {turnAverage(turn)!.toFixed(1)}
                      {(s.tries ?? 1) > 1 ? ` · best of ${s.tries} tries` : ""}
                    </p>
                  )}
                  {turn?.biggest_fix && (
                    <p className="mt-2">
                      <span className="font-semibold">Biggest fix: </span>
                      {turn.biggest_fix}
                    </p>
                  )}
                  {turn?.transcript && (
                    <p className="mt-2">
                      <span className="font-semibold">Your answer: </span>
                      {turn.transcript}
                    </p>
                  )}
                  {turn?.suggested_answer && turn.suggested_answer !== turn.transcript && (
                    <p className="mt-2">
                      <span className="font-semibold">A stronger version: </span>
                      {turn.suggested_answer}
                    </p>
                  )}
                </>
              )}
            </article>
          );
        })}
      </section>

      <footer className="mt-8 border-t border-border pt-3 text-xs text-ink-muted">
        Every stronger version uses only your profile and what you said. Fill any [your real …] blank with your real detail.
      </footer>
    </main>
  );
}
