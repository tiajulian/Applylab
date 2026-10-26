"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { cleanCompanyName, cleanJobTitle, companyOrFallback } from "@/lib/applications/jobListing";
import { clsx } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/analytics";
import { useProgressStage } from "@/lib/hooks/useProgressMessages";
import { formatRelativeDistanceMelbourne, diffCalendarDaysMelbourne } from "@/lib/dateUtils";
import { targetJobTitle } from "@/lib/resume/generalResume";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import {
  MicIcon,
  LockIcon,
  KeyboardIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleIcon,
  CalendarIcon,
  FilePenLineIcon,
  FileTextIcon,
  BriefcaseIcon,
} from "@/components/ui/icons/LucideIcons";
import { PracticeHistory } from "@/components/interview/PracticeHistory";
import { EMPTY_OWN_RESUME_DRAFT, OwnResumeSetup, ownDraftReady, type OwnResumeDraft } from "@/components/interview/OwnResumeSetup";
import { practiceJobKey } from "@/lib/interview/uploadedResume";
import { ProgressChart } from "@/components/interview/ProgressChart";
import { freePracticesLeft } from "@/lib/interview/allowanceClient";
import type { HistoryItem, PracticeSummary, ProgressPoint } from "@/lib/interview/history";
import {
  getAnswerModePreference,
  getHideQuestionTextPreference,
  setAnswerModePreference,
  setHideQuestionTextPreference,
} from "@/lib/interview/questionDisplayPreference";
import {
  STAGES,
  PRIMARY_STAGE_TYPES,
  ANSWER_MODES,
  QUESTION_DISPLAY_OPTIONS,
  FREE_INTERVIEW_ALLOWANCE,
  estimateMinutes,
  resolveStage,
  type AnswerMode,
  type StageOption,
} from "@/lib/interview/setupConstants";
import type {
  InterviewStageType,
  StarPart,
  Resume,
  AppUser,
  Application,
  ApplicationInterview,
  UploadedResumeSummary,
} from "@/types";

const START_SESSION_STAGES = [
  "Reading your target job ad",
  "Matching questions to your confirmed experience",
  "Calibrating difficulty & question mix",
  "Preparing your interview session",
];

export interface InterviewSetupProps {
  resumes: Resume[];
  /** Saved "Upload my resume" resumes. */
  uploadedResumes?: UploadedResumeSummary[];
  user: AppUser;
  applications?: Application[];
  interviews?: ApplicationInterview[];
  initialApplicationId?: string;
  initialStage?: string;
  initialInterviewId?: string;
  /** Skills + tools on the Career Profile: what the question writer is actually sent. */
  profileSkillCount?: number;
  /** Confirmed role duties the question writer is sent. */
  profileDutyCount?: number;
  history?: HistoryItem[];
  historyPage?: number;
  historyPageCount?: number;
  /** First-try scores per scored session, oldest first. */
  progress?: ProgressPoint[];
  /** Finished practice per scheduled round (application_interviews.id). */
  roundPractice?: Record<string, PracticeSummary>;
}

const HOW_PRACTICE_WORKS = [
  { title: "Pick a job", body: "Choose one of your tailored resumes. Questions are about that job." },
  { title: "Answer out loud or by typing", body: "Like a real interview, one question at a time." },
  { title: "Get feedback", body: "See what was strong and what to add, using the STAR method (Situation, Task, Action, Result)." },
];

const STAGE_NOUNS: Record<InterviewStageType, string> = {
  phone_screen: "phone screen",
  technical: "technical interview",
  panel: "panel interview",
  async_video: "recorded video interview",
  group: "assessment day",
  general: "interview",
  coding: "coding interview",
};

const UPCOMING_WINDOW_DAYS = 7;

/** Where the job comes from: an ApplyLab resume, the user's own resume plus the job ad, or the
 *  job ad alone (grounded in the Career Profile). The last two are Pro. */
type JobSource = "applylab" | "upload" | "job_ad";

const JOB_SOURCES: { value: JobSource; title: string; hint: string; Icon: typeof BriefcaseIcon }[] = [
  { value: "applylab", title: "An ApplyLab resume", hint: "A resume you made here", Icon: FilePenLineIcon },
  { value: "upload", title: "My own resume", hint: "Plus the job ad you applied to", Icon: FileTextIcon },
  { value: "job_ad", title: "Just the job ad", hint: "We use your profile for the rest", Icon: BriefcaseIcon },
];

const resumeOptionLabel = (r: Pick<Resume, "job_title" | "company_name">) =>
  [r.job_title || "General resume", cleanCompanyName(r.company_name)].filter(Boolean).join(" · ");

/** Moves selection with the arrow keys and keeps focus on the selected option (roving tabindex). */
function arrowIndex(key: string, current: number, length: number): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % length;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + length) % length;
  return null;
}

function SelectedRing() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-[-1px] -z-0 rounded-lg border-2 border-accent bg-accent-soft"
    />
  );
}

function SelectedCheck() {
  return (
    <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
      <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

export function InterviewSetup({
  resumes,
  uploadedResumes = [],
  user,
  applications = [],
  interviews = [],
  initialApplicationId,
  initialStage,
  initialInterviewId,
  profileSkillCount = 0,
  profileDutyCount = 0,
  history = [],
  historyPage = 1,
  historyPageCount = 1,
  progress = [],
  roundPractice = {},
}: InterviewSetupProps) {
  const router = useRouter();

  const [linkedApplicationId, setLinkedApplicationId] = useState(initialApplicationId);
  const [linkedInterviewId, setLinkedInterviewId] = useState(initialInterviewId);
  const linkedApplication = linkedApplicationId ? applications.find((a) => a.id === linkedApplicationId) : null;
  const linkedInterview = linkedInterviewId ? interviews.find((i) => i.id === linkedInterviewId) : null;

  // Derive initial resume
  const defaultResumeId = (() => {
    if (linkedApplication?.resume_id) {
      const match = resumes.find((r) => r.id === linkedApplication.resume_id);
      if (match) return match.id;
    }
    return resumes.length > 0 ? resumes[0].id : "";
  })();

  const [selectedResumeId, setSelectedResumeId] = useState<string>(defaultResumeId);
  const isFreePlan = user.plan === "free";
  const freeLeft = freePracticesLeft(user);
  // Own resume or job ad only (Pro): for jobs applied to outside ApplyLab. With no ApplyLab resumes
  // it's the default (a saved resume of their own first, else the job ad alone once the profile has
  // something to ground it); opened from the tracker, the job and link are filled in already.
  const [savedUploads, setSavedUploads] = useState(uploadedResumes);
  const [source, setSource] = useState<JobSource>(() =>
    isFreePlan || resumes.length > 0
      ? "applylab"
      : uploadedResumes.length === 0 && profileDutyCount + profileSkillCount > 0
        ? "job_ad"
        : "upload"
  );
  const useOwnJob = source !== "applylab";
  const [ownDraft, setOwnDraft] = useState<OwnResumeDraft>(() =>
    withLinkedJob({ ...EMPTY_OWN_RESUME_DRAFT, uploadedResumeId: uploadedResumes[0]?.id ?? null })
  );

  /** The tracked application the page was opened for, as the upload draft's job and link. */
  function withLinkedJob(draft: OwnResumeDraft): OwnResumeDraft {
    if (!linkedApplication || draft.link || draft.jobTitle.trim()) return draft;
    const jobTitle = cleanJobTitle(linkedApplication.job_title);
    const companyName = cleanCompanyName(linkedApplication.company_name);
    return {
      ...draft,
      jobTitle,
      companyName,
      link: {
        applicationId: linkedApplication.id,
        interviewId: linkedInterview?.id ?? null,
        label: [jobTitle, companyName].filter(Boolean).join(" at "),
      },
    };
  }
  const [selectedStage, setSelectedStage] = useState<InterviewStageType>(() =>
    isFreePlan ? FREE_INTERVIEW_ALLOWANCE.stageType : resolveStage(initialStage, linkedInterview?.stage_type)
  );
  const [mode, setMode] = useState<AnswerMode>("voice");
  const [hideQuestionText, setHideQuestionText] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [moreTypesOpen, setMoreTypesOpen] = useState(false);
  const [upcoming, setUpcoming] = useState<{ interview: ApplicationInterview; app: Application; when: string } | null>(null);
  const [storyHints, setStoryHints] = useState(true);
  const [focusPart, setFocusPart] = useState<StarPart | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const { currentStage, stageIndex, progressPct } = useProgressStage(
    START_SESSION_STAGES,
    isStarting,
    2200
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stageButtonRefs = useRef<Map<InterviewStageType, HTMLButtonElement>>(new Map());
  const sourceButtonRefs = useRef<Map<JobSource, HTMLButtonElement>>(new Map());

  const moreTypesKey = `applylab:interview:moreTypes:${user.id}`;
  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];
  const selectedStageOption = STAGES.find((s) => s.type === selectedStage) || STAGES[0];
  const isGeneralResume = !targetJobTitle(selectedResume?.job_title);
  const hiddenStageCount = STAGES.length - PRIMARY_STAGE_TYPES.length;
  const visibleStages = moreTypesOpen ? STAGES : STAGES.filter((s) => PRIMARY_STAGE_TYPES.includes(s.type));

  // The interview this practice is for: the one the page was opened for, else the next one coming up.
  const matchedStage = useMemo<InterviewStageType | null>(() => {
    const round = linkedInterview ?? upcoming?.interview;
    return round ? resolveStage(undefined, round.stage_type) : null;
  }, [linkedInterview, upcoming]);

  const groundingParts = [
    profileDutyCount > 0 ? `${profileDutyCount} ${profileDutyCount === 1 ? "duty" : "duties"}` : null,
    profileSkillCount > 0 ? `${profileSkillCount} ${profileSkillCount === 1 ? "skill" : "skills"}` : null,
  ].filter(Boolean);
  const profileGrounding = groundingParts.length ? `${groundingParts.join(" and ")} from your profile` : null;
  const groundingText =
    source === "upload"
      ? "Questions use your resume and this job ad"
      : source === "job_ad"
        ? `Questions use this job ad${profileGrounding ? ` and ${profileGrounding}` : " and your profile"}`
        : profileGrounding
          ? `Questions use this job and ${profileGrounding}`
          : "Questions use this job and your profile";

  const moreSettingsSummary = `${
    hideQuestionText ? QUESTION_DISPLAY_OPTIONS.hear.shortLabel : QUESTION_DISPLAY_OPTIONS.show.shortLabel
  } · Story hints ${storyHints ? "on" : "off"}`;

  // Free practice: fixed to a short Standard session, so the rail shows what will really happen.
  const sessionQuestions = isFreePlan ? `Your free practice: ${FREE_INTERVIEW_ALLOWANCE.questionCount} questions` : selectedStageOption.questions;
  const sessionLength = isFreePlan
    ? `about ${estimateMinutes(FREE_INTERVIEW_ALLOWANCE.stageType, FREE_INTERVIEW_ALLOWANCE.questionCount)} min`
    : selectedStageOption.length;
  const isLocked = (type: InterviewStageType) => isFreePlan && type !== FREE_INTERVIEW_ALLOWANCE.stageType;
  const matchedRoundId = linkedInterview?.id ?? upcoming?.interview.id ?? null;
  const readiness = matchedRoundId ? roundPractice[matchedRoundId] : undefined;

  // Hydration-safe initial preference load
  useEffect(() => {
    setHideQuestionText(getHideQuestionTextPreference());
    setMode(getAnswerModePreference());
    try {
      if (localStorage.getItem(moreTypesKey) === "1") setMoreTypesOpen(true);
    } catch {
      // Storage disabled: the extra types just start collapsed.
    }
    trackFunnelEvent("interview_setup_viewed");
  }, [moreTypesKey]);

  // Next scheduled round within a week (client-side so "in 2 days" uses the viewer's clock).
  useEffect(() => {
    const now = new Date();
    const next = interviews
      .filter((i) => i.outcome === "scheduled" && new Date(i.scheduled_at).getTime() >= now.getTime())
      .filter((i) => {
        const days = diffCalendarDaysMelbourne(i.scheduled_at, now);
        return days >= 0 && days <= UPCOMING_WINDOW_DAYS;
      })
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .map((i) => ({ interview: i, app: applications.find((a) => a.id === i.application_id) }))
      .find((x): x is { interview: ApplicationInterview; app: Application } => Boolean(x.app));
    setUpcoming(
      next
        ? { ...next, when: formatRelativeDistanceMelbourne(next.interview.scheduled_at, now, next.interview.is_deadline) }
        : null
    );
  }, [interviews, applications]);

  // A preselected type in the hidden group opens the group so the selection is never invisible.
  useEffect(() => {
    if (!PRIMARY_STAGE_TYPES.includes(selectedStage)) setMoreTypesOpen(true);
  }, [selectedStage]);

  function toggleMoreTypes() {
    const next = !moreTypesOpen;
    setMoreTypesOpen(next);
    try {
      localStorage.setItem(moreTypesKey, next ? "1" : "0");
    } catch {
      // Not remembered across visits; harmless.
    }
  }

  function handleStageKeyDown(e: React.KeyboardEvent, currentType: InterviewStageType) {
    const selectable = visibleStages.filter((v) => !isLocked(v.type));
    const nextIndex = arrowIndex(e.key, Math.max(0, selectable.findIndex((v) => v.type === currentType)), selectable.length);
    if (nextIndex === null) return;
    e.preventDefault();
    const nextType = selectable[nextIndex].type;
    setSelectedStage(nextType);
    stageButtonRefs.current.get(nextType)?.focus();
  }

  function chooseMode(next: AnswerMode) {
    setMode(next);
    setAnswerModePreference(next);
  }

  function handleModeKeyDown(e: React.KeyboardEvent) {
    if (arrowIndex(e.key, 0, 2) !== null) {
      e.preventDefault();
      chooseMode(mode === "voice" ? "text" : "voice");
    }
  }

  function practiseForUpcoming() {
    if (!upcoming) return;
    setLinkedApplicationId(upcoming.app.id);
    setLinkedInterviewId(upcoming.interview.id);
    if (upcoming.app.resume_id && resumes.some((r) => r.id === upcoming.app.resume_id)) {
      setSelectedResumeId(upcoming.app.resume_id);
    }
    if (!isFreePlan) setSelectedStage(resolveStage(undefined, upcoming.interview.stage_type));
  }

  function scrollToSetup() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function practisePart(part: StarPart) {
    setFocusPart(part);
    if (!isFreePlan) setSelectedStage("general");
    scrollToSetup();
  }

  const canStart = useOwnJob ? ownDraftReady(ownDraft, source === "job_ad") : Boolean(selectedResumeId);

  const isSourceLocked = (value: JobSource) => isFreePlan && value !== "applylab";

  function chooseSource(next: JobSource) {
    if (next === "upload" && next !== source) trackFunnelEvent("interview_upload_resume_clicked", { is_free: isFreePlan });
    if (isSourceLocked(next)) {
      router.push("/upgrade");
      return;
    }
    if (next !== "applylab") setOwnDraft(withLinkedJob);
    setSource(next);
  }

  function handleSourceKeyDown(e: React.KeyboardEvent) {
    const selectable = JOB_SOURCES.filter((s) => !isSourceLocked(s.value));
    const nextIndex = arrowIndex(e.key, Math.max(0, selectable.findIndex((s) => s.value === source)), selectable.length);
    if (nextIndex === null) return;
    e.preventDefault();
    const next = selectable[nextIndex].value;
    chooseSource(next);
    sourceButtonRefs.current.get(next)?.focus();
  }

  async function handleStartSession() {
    if (!canStart) {
      setErrorMsg(
        source === "upload"
          ? "Choose a resume and paste the job ad first."
          : source === "job_ad"
            ? "Paste the job ad and add the job title first."
            : "Please select a target job or resume."
      );
      return;
    }
    const ownJob = {
      job_title: ownDraft.jobTitle.trim(),
      company_name: ownDraft.companyName.trim(),
      job_description: ownDraft.jobDescription.trim(),
      ...(ownDraft.link
        ? { application_id: ownDraft.link.applicationId, ...(ownDraft.link.interviewId ? { interview_id: ownDraft.link.interviewId } : {}) }
        : {}),
    };
    const jobSource =
      source === "upload"
        ? { uploaded_resume_id: ownDraft.uploadedResumeId, ...ownJob }
        : source === "job_ad"
          ? { job_ad_only: true, ...ownJob }
          : {
              resume_id: selectedResumeId,
              ...(linkedApplication ? { application_id: linkedApplication.id } : {}),
              ...(linkedApplication && linkedInterview ? { interview_id: linkedInterview.id } : {}),
            };

    setIsStarting(true);
    setErrorMsg(null);
    setAnswerModePreference(mode);

    try {
      const res = await fetch("/api/interview/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...jobSource,
          stage_type: selectedStage,
          story_hints: storyHints,
          ...(focusPart ? { focus_part: focusPart } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "FREE_LIMIT_REACHED") router.refresh();
        throw new Error(data.error || "Failed to start interview session");
      }

      trackFunnelEvent("interview_session_started", {
        type: selectedStage,
        mode,
        from_application: useOwnJob ? Boolean(ownDraft.link) : Boolean(linkedApplication),
        from_upload: source === "upload",
        from_job_ad: source === "job_ad",
        is_free: isFreePlan,
      });
      router.push(`/interview/${data.sessionId}`);
    } catch (err: unknown) {
      console.error("Start session error", err);
      setErrorMsg(
        (err as Error).message || "Failed to launch interview session"
      );
      setIsStarting(false);
    }
  }

  if (isFreePlan && (freeLeft === 0 || resumes.length === 0)) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          step={4}
          title="Interview practice"
          subtitle="Practise answering the questions you're likely to get for a job, and get feedback on each answer."
        />
        <section
          aria-labelledby="how-practice-works"
          className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7"
        >
          <h2 id="how-practice-works" className="text-[18px] font-semibold text-ink">
            How it works
          </h2>
          <ol className="flex flex-col gap-4">
            {HOW_PRACTICE_WORKS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-deep text-[14px] font-bold text-ink-secondary"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">
                  <span className="block text-[15.5px] font-semibold text-ink">{step.title}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-secondary">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col items-start gap-2 border-t border-border pt-5">
            {isFreePlan && freeLeft === 0 ? (
              <>
                <Button href="/upgrade" size="lg">
                  Go Pro to keep practising
                </Button>
                <p className="text-[13.5px] text-ink-muted">
                  You&apos;ve used your free practice. Pro gives you every interview type, all 8+ questions, retries
                  and progress tracking.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button href="/resume/new" size="lg">
                    Make a tailored resume first
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => chooseSource("upload")} className="gap-2">
                    Upload my resume
                    <Badge variant="neutral" className="rounded-pill px-2 py-0.5 text-[11px]">
                      <LockIcon className="h-3 w-3" aria-hidden="true" />
                      Pro
                    </Badge>
                  </Button>
                </div>
                <p className="text-[13.5px] text-ink-muted">
                  Questions are based on a job ad, so you need a resume to start. With Pro you can use any resume, even one not
                  made in ApplyLab.
                </p>
              </>
            )}
          </div>
        </section>
        {history.length > 0 && (
          <PracticeHistory items={history} page={historyPage} pageCount={historyPageCount} onStartFirst={scrollToSetup} />
        )}
      </div>
    );
  }

  function renderStageCard(s: StageOption) {
    const isSelected = s.type === selectedStage;
    const locked = isLocked(s.type);
    const badge = locked
      ? { text: "Pro", variant: "neutral" as const }
      : matchedStage === s.type
        ? { text: "Matches your interview", variant: "success" as const }
        : s.badge && !(matchedStage && s.badge === "Most popular")
          ? { text: s.badge, variant: s.badgeVariant || "accent" }
          : null;

    return (
      <button
        key={s.type}
        ref={(el) => {
          if (el) stageButtonRefs.current.set(s.type, el);
          else stageButtonRefs.current.delete(s.type);
        }}
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-disabled={locked || undefined}
        aria-label={locked ? `${s.title} (Pro)` : undefined}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => !locked && setSelectedStage(s.type)}
        onKeyDown={(e) => handleStageKeyDown(e, s.type)}
        className={clsx(
          "relative flex select-none flex-col rounded-lg border border-border bg-surface p-4 text-left transition-all duration-fast",
          locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-pop motion-reduce:hover:translate-y-0",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          isSelected && "shadow-sm"
        )}
      >
        {isSelected && <SelectedRing />}
        <div className="relative z-10 flex w-full flex-1 flex-col justify-between gap-3">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15px] font-bold leading-[1.25] text-ink">{s.title}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {badge && (
                  <Badge variant={badge.variant} className="rounded-pill px-2 py-0.5 text-[11px]">
                    {locked && <LockIcon className="h-3 w-3" aria-hidden="true" />}
                    {badge.text}
                  </Badge>
                )}
                {isSelected && <SelectedCheck />}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">{s.description}</p>
          </div>
          <div className="mt-auto border-t border-border pt-2.5 text-[11.5px] font-medium text-ink-muted">{s.meta}</div>
        </div>
      </button>
    );
  }

  const showUpcomingBanner = !useOwnJob && upcoming && upcoming.interview.id !== linkedInterview?.id;

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header (Full Width) */}
      <div className="flex flex-col items-start text-left">
        <PageHeader
          step={4}
          title="Interview practice"
          subtitle="Pick a job and the kind of interview. We ask questions about that job, you answer, and you get feedback you can act on."
        />

        {linkedApplication && !useOwnJob && (
          <div className="mt-4 flex w-full items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft/50 p-3.5">
            <CheckIcon className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
            <div className="flex flex-col">
              <span className="text-[12.5px] font-medium text-ink-secondary">
                Practising for your scheduled interview
              </span>
              <span className="text-sm font-semibold text-ink">
                {[cleanJobTitle(linkedApplication.job_title), cleanCompanyName(linkedApplication.company_name)].filter(Boolean).join(" at ") || "This job"} ({selectedStageOption.title})
              </span>
              {readiness && (
                <span className="text-xs text-ink-secondary">
                  Practised {readiness.count} {readiness.count === 1 ? "time" : "times"}
                  {readiness.lastScore !== null && ` · last ${readiness.lastScore.toFixed(1)}`}
                  {readiness.weakestPart && ` · Weakest: ${readiness.weakestPart}`}
                </span>
              )}
            </div>
          </div>
        )}

        {showUpcomingBanner && (
          <div className="mt-4 flex w-full flex-col gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
              <p className="text-sm text-ink">
                Your{" "}
                <strong className="font-semibold">
                  {STAGE_NOUNS[upcoming.interview.stage_type] ?? "interview"} with {companyOrFallback(upcoming.app.company_name)}
                </strong>{" "}
                is <strong className="font-semibold">{upcoming.when}</strong>.
                {readiness && (
                  <span className="block text-xs text-ink-secondary">
                    Practised {readiness.count} {readiness.count === 1 ? "time" : "times"}
                    {readiness.weakestPart && ` · Weakest: ${readiness.weakestPart}`}
                  </span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={practiseForUpcoming} className="shrink-0 rounded-pill">
              {readiness ? "Practise again" : "Practise for it"}
            </Button>
          </div>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 items-start gap-[30px] lg:grid-cols-[minmax(0,1fr)_348px]">
        {/* Left Column: Context, decisions, More Settings */}
        <div className="flex flex-col gap-6">
          {/* Decision 1: Which job? An ApplyLab resume, the user's own resume, or the job ad alone. */}
          <section className="flex flex-col gap-3">
            <h2 id="job-heading" className="font-display text-[19px] font-semibold leading-tight text-ink">
              Which job are you practising for?
            </h2>

            <div className="rounded-lg border border-border bg-surface shadow-sm">
              <div role="radiogroup" aria-labelledby="job-heading" className="grid grid-cols-1 gap-1.5 border-b border-border p-2 sm:grid-cols-3">
                {JOB_SOURCES.map(({ value, title, hint, Icon }) => {
                  const isSel = source === value;
                  const locked = isSourceLocked(value);
                  return (
                    <button
                      key={value}
                      ref={(el) => {
                        if (el) sourceButtonRefs.current.set(value, el);
                        else sourceButtonRefs.current.delete(value);
                      }}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      aria-label={locked ? `${title} (Pro)` : undefined}
                      tabIndex={isSel ? 0 : -1}
                      onClick={() => chooseSource(value)}
                      onKeyDown={handleSourceKeyDown}
                      className={clsx(
                        "flex items-start gap-2.5 rounded-md border p-3 text-left transition-colors duration-fast",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        isSel ? "border-accent bg-accent-soft" : "border-transparent hover:bg-paper-deep"
                      )}
                    >
                      <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", isSel ? "text-accent" : "text-ink-muted")} strokeWidth={2} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                          {title}
                          {locked && (
                            <Badge variant="neutral" className="rounded-pill px-1.5 py-0 text-[10.5px]">
                              <LockIcon className="h-3 w-3" aria-hidden="true" />
                              Pro
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-4 p-4 sm:p-5">
                {useOwnJob ? (
                  <OwnResumeSetup
                    savedResumes={savedUploads}
                    onSavedResumesChange={setSavedUploads}
                    draft={ownDraft}
                    onDraftChange={setOwnDraft}
                    applications={applications}
                    interviews={interviews}
                    jobOnly={source === "job_ad"}
                  />
                ) : resumes.length === 0 ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-ink-secondary">
                      You haven&apos;t made a resume in ApplyLab yet. Make one for a job, or use your own resume or the job ad above.
                    </p>
                    <Button href="/resume/new" variant="outline" size="sm" className="rounded-pill text-xs">
                      Make a tailored resume
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Select
                      id="practice-resume"
                      label="Resume"
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      className="w-full"
                    >
                      {resumes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {resumeOptionLabel(r)}
                        </option>
                      ))}
                    </Select>
                    {isGeneralResume && (
                      <p className="text-xs text-ink-secondary">
                        This is a general resume, so questions are broad. For sharper ones,{" "}
                        <Link href="/resume/new" className="font-semibold text-accent underline underline-offset-2">
                          tailor a resume to a job ad
                        </Link>{" "}
                        or paste the job ad above.
                      </p>
                    )}
                  </div>
                )}

                {(useOwnJob || resumes.length > 0) && (
                  <p className="flex items-start gap-1.5 border-t border-border pt-3 text-xs text-ink-secondary">
                    <CheckIcon className="mt-px h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2} />
                    <span>
                      {groundingText}.
                      {source === "job_ad" && !profileGrounding && (
                        <>
                          {" "}Your profile is empty, so questions will be general.{" "}
                          <Link href="/profile" className="font-semibold text-accent underline underline-offset-2">
                            Add your experience
                          </Link>
                        </>
                      )}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Decision 2: What kind of interview are you practising for? */}
          <section className="flex flex-col gap-3">
            <h2 id="stage-heading" className="font-display text-[19px] font-semibold leading-tight text-ink">
              What kind of interview are you practising for?
            </h2>

            <div
              role="radiogroup"
              aria-labelledby="stage-heading"
              className="grid grid-cols-1 items-stretch gap-3.5 min-[720px]:grid-cols-2 min-[1180px]:grid-cols-3"
            >
              {visibleStages.map(renderStageCard)}
            </div>

            <button
              type="button"
              aria-expanded={moreTypesOpen}
              onClick={toggleMoreTypes}
              disabled={moreTypesOpen && !PRIMARY_STAGE_TYPES.includes(selectedStage)}
              className="self-start rounded text-sm font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {moreTypesOpen ? "Fewer interview types" : `More interview types (${hiddenStageCount})`}
            </button>
          </section>

          {/* Decision 3: How do you want to answer? */}
          <section className="flex flex-col gap-3">
            <h2 id="mode-heading" className="font-display text-[19px] font-semibold leading-tight text-ink">
              How do you want to answer?
            </h2>

            <div
              role="radiogroup"
              aria-labelledby="mode-heading"
              className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2"
            >
              {(["voice", "text"] as AnswerMode[]).map((m) => {
                const option = ANSWER_MODES[m];
                const isSel = mode === m;
                const Icon = m === "voice" ? MicIcon : KeyboardIcon;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    tabIndex={isSel ? 0 : -1}
                    onClick={() => chooseMode(m)}
                    onKeyDown={handleModeKeyDown}
                    className={clsx(
                      "relative flex cursor-pointer select-none flex-col rounded-lg border border-border bg-surface p-4 text-left transition-all duration-fast sm:p-5",
                      "hover:-translate-y-0.5 hover:shadow-pop motion-reduce:hover:translate-y-0",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                      isSel && "shadow-sm"
                    )}
                  >
                    {isSel && <SelectedRing />}
                    <div className="relative z-10 flex w-full flex-1 flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className={clsx("h-4 w-4 shrink-0", m === "voice" ? "text-accent" : "text-ink-secondary")} strokeWidth={2} />
                          <span className="text-[15px] font-bold leading-[1.25] text-ink">{option.title}</span>
                        </div>
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          {option.badge && (
                            <Badge variant="accent" className="rounded-pill px-2 py-0.5 text-[11px]">
                              {option.badge}
                            </Badge>
                          )}
                          {isSel && <SelectedCheck />}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* More Settings Disclosure */}
          <section className="flex flex-col">
            <button
              type="button"
              aria-expanded={advOpen}
              onClick={() => setAdvOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition-colors hover:bg-paper-deep focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="text-sm font-semibold text-ink">More settings</span>
              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <span>{moreSettingsSummary}</span>
                <ChevronDownIcon
                  className={clsx(
                    "h-4 w-4 text-ink-secondary transition-transform duration-fast",
                    advOpen && "rotate-180"
                  )}
                  strokeWidth={2}
                />
              </div>
            </button>

            {advOpen && (
              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
                <span id="display-heading" className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                  SEEING THE QUESTIONS
                </span>
                <div role="radiogroup" aria-labelledby="display-heading" className="inline-flex w-full rounded-pill bg-paper-deep p-1 sm:max-w-sm">
                  {(["show", "hear"] as const).map((key) => {
                    const option = QUESTION_DISPLAY_OPTIONS[key];
                    const isSel = hideQuestionText === option.hide;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={isSel}
                        onClick={() => {
                          setHideQuestionText(option.hide);
                          setHideQuestionTextPreference(option.hide);
                        }}
                        className={clsx(
                          "flex flex-1 items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          isSel ? "bg-accent font-semibold text-on-accent shadow-sm" : "text-ink-secondary hover:text-ink"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  {hideQuestionText ? QUESTION_DISPLAY_OPTIONS.hear.hint : QUESTION_DISPLAY_OPTIONS.show.hint}
                </p>

                <label className="mt-2 flex cursor-pointer items-start gap-3 border-t border-border pt-4">
                  <input
                    type="checkbox"
                    checked={storyHints}
                    onChange={(e) => setStoryHints(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-accent"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">Story hints</span>
                    <span className="block text-[12.5px] leading-relaxed text-ink-muted">
                      Shows stories from your {source === "upload" ? "resume" : "profile"} that could fit each question.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </section>

          {errorMsg && (
            <div role="alert" className="rounded-lg bg-critical-soft p-4 text-sm text-ink">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Right Column: sticky rail on desktop; a summary block above the sticky Start bar below
            lg. 64px is the measured dashboard nav height (see components/resume/ResumeWorkspace.tsx). */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-[64px]">
          {/* 1. Session Summary Card */}
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-pop">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                YOUR PRACTICE SESSION
              </span>
              <h3 className="mt-1 font-display text-[21px] font-bold leading-tight text-ink">
                {selectedStageOption.title}
              </h3>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-secondary">
                {selectedStageOption.persona}
              </p>
            </div>

            {/* Nested Stat Panel */}
            <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-paper-deep/40 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">How long</span>
                <span className="font-semibold text-ink">{sessionLength}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Questions</span>
                <span className="font-semibold text-ink">{sessionQuestions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Answering by</span>
                <span className="font-semibold text-ink">{ANSWER_MODES[mode].railLabel}</span>
              </div>
              {focusPart && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Focus</span>
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    {focusPart.charAt(0).toUpperCase() + focusPart.slice(1)} questions
                    <button
                      type="button"
                      onClick={() => setFocusPart(null)}
                      aria-label="Remove focus"
                      className="rounded px-1 text-ink-muted hover:text-ink"
                    >
                      ×
                    </button>
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
                <span className="text-ink-muted">Feedback on</span>
                <span className="text-[11.5px] font-medium leading-snug text-ink">
                  {selectedStageOption.feedbackOn}
                </span>
              </div>
            </div>

            {/* Loading Progress: what's happening while questions are generated */}
            {isStarting && (
              <div className="flex flex-col gap-2.5 rounded-lg border border-accent/30 bg-accent-soft/40 p-3.5 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">{currentStage}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-accent">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
                  <div
                    className="h-full bg-accent transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex flex-col gap-1 text-[11px]">
                  {START_SESSION_STAGES.map((stage, idx) => (
                    <div
                      key={stage}
                      className={clsx(
                        "flex items-center gap-1.5 transition-colors",
                        idx < stageIndex
                          ? "font-medium text-success"
                          : idx === stageIndex
                          ? "font-semibold text-accent"
                          : "text-ink-muted"
                      )}
                    >
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">{idx < stageIndex ? <CheckIcon className="h-3.5 w-3.5" /> : idx === stageIndex ? <ChevronRightIcon className="h-3.5 w-3.5" /> : <CircleIcon className="h-3 w-3" />}</span>
                      <span className="truncate">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Action Button (desktop; phones use the sticky bar below) */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartSession}
              isLoading={isStarting}
              disabled={!canStart}
              className="hidden w-full justify-center rounded-pill py-3 text-base font-semibold lg:inline-flex"
            >
              {isStarting ? "Constructing your questions…" : isFreePlan ? "Start my free practice" : "Start practising"}
            </Button>

            {/* Reassurance copy */}
            {!isStarting && (
              <p className="text-center text-[12px] leading-relaxed text-ink-muted">
                Pause or end at any point. Your feedback is saved either way.
              </p>
            )}
          </div>

          {/* 2. Grounding Card */}
          <div className="flex flex-col gap-2 rounded-lg border border-success/20 bg-success-soft p-5 shadow-sm">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-success">
              WE NEVER MAKE THINGS UP
            </span>
            <p className="text-[13px] font-normal leading-relaxed text-ink-secondary">
              Every question comes from your job and your real experience. If you haven&apos;t done something, we help you say so honestly.
            </p>
          </div>
        </div>
      </div>

      {/* Progress over time and history */}
      <div className="flex flex-col gap-6">
        <ProgressChart
          points={progress}
          currentJobKey={
            useOwnJob
              ? practiceJobKey({
                  resume_id: null,
                  uploaded_resume_id: source === "upload" ? ownDraft.uploadedResumeId : null,
                  job_title: ownDraft.jobTitle.trim(),
                  company_name: ownDraft.companyName.trim() || null,
                })
              : selectedResumeId
          }
          onPractisePart={practisePart}
        />
        <PracticeHistory items={history} page={historyPage} pageCount={historyPageCount} onStartFirst={scrollToSetup} />
      </div>

      {/* Sticky Start bar below lg, sitting just above the mobile tab bar. */}
      <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 rounded-lg border border-border bg-surface/95 p-3 shadow-pop backdrop-blur-[10px] lg:hidden">
        <Button
          variant="primary"
          size="lg"
          onClick={handleStartSession}
          isLoading={isStarting}
          disabled={!canStart}
          className="w-full justify-center rounded-pill py-3 text-base font-semibold"
        >
          {isStarting ? currentStage : isFreePlan ? "Start my free practice" : "Start practising"}
        </Button>
      </div>
    </div>
  );
}
