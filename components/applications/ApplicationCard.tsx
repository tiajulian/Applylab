"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  CalendarIcon,
  MicIcon,
  Building2Icon,
  BriefcaseIcon,
  ExternalLinkIcon,
  TrashIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  ChevronDownIcon,
  FileTextIcon,
} from "@/components/ui/icons/LucideIcons";
import { formatInterviewDateTime, getMelbourneDateString } from "@/lib/dateUtils";
import { classifyInterviewingApplication } from "@/lib/dashboard/pipeline";
import { STATUS_OPTIONS, STATUS_BADGE_VARIANT } from "@/lib/applications/stageLabels";
import type { ResumeOption } from "@/components/applications/ApplicationsBoard";
import type {
  Application,
  ApplicationStatus,
  ApplicationInterview,
  InterviewStageType,
  InterviewOutcome,
} from "@/types";

export const STAGE_LABELS: Record<InterviewStageType, string> = {
  phone_screen: "Phone screen",
  technical: "Technical & practical",
  panel: "Panel interview",
  async_video: "Async video",
  group: "Assessment centre",
  general: "General behavioural",
  coding: "Coding round",
};

const STAGE_OPTIONS: { value: InterviewStageType; label: string }[] = [
  { value: "phone_screen", label: "Phone screen" },
  { value: "technical", label: "Technical & practical" },
  { value: "coding", label: "Coding round" },
  { value: "panel", label: "Panel interview" },
  { value: "async_video", label: "Async video" },
  { value: "group", label: "Assessment centre" },
  { value: "general", label: "General behavioural" },
];

// Generates consistent initials and pleasant warm background color for company logos
function getCompanyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CO";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  { bg: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  { bg: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { bg: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { bg: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { bg: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  { bg: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  { bg: "bg-teal-100 text-teal-700 border-teal-200", dot: "bg-teal-500" },
];

function getCompanyColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function ApplicationCard({
  application,
  resumes,
  interviews = [],
  onUpdated,
  onStatusRollback,
  onDeleted,
  onInterviewsUpdated,
}: {
  application: Application;
  resumes: ResumeOption[];
  interviews?: ApplicationInterview[];
  onUpdated: (application: Application) => void;
  onStatusRollback: (id: string, expectedStatus: ApplicationStatus, revertTo: Application) => void;
  onDeleted: (id: string) => void;
  onInterviewsUpdated?: (applicationId: string, interviews: ApplicationInterview[]) => void;
}) {
  const { showToast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interview state
  const [isAddingRound, setIsAddingRound] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [showAllRounds, setShowAllRounds] = useState(false);
  const [isSavingRound, setIsSavingRound] = useState(false);

  // Form state for adding/editing interview round
  const [stageType, setStageType] = useState<InterviewStageType>(() =>
    interviews.length > 0 ? "panel" : "phone_screen"
  );
  const [scheduledDate, setScheduledDate] = useState(() => getMelbourneDateString());
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [isDeadline, setIsDeadline] = useState(false);
  const [location, setLocation] = useState("");
  const [roundNotes, setRoundNotes] = useState("");

  const linkedResume = application.resume_id
    ? resumes.find((resume) => resume.id === application.resume_id)
    : null;

  // Filter scheduled rounds and sort ascending by date
  const scheduledRounds = interviews
    .filter((i) => i.outcome === "scheduled")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const soonestRound = scheduledRounds[0];
  const otherRounds = interviews.filter((i) => !soonestRound || i.id !== soonestRound.id);

  const initials = getCompanyInitials(application.company_name);
  const palette = getCompanyColor(application.company_name);

  async function handleStatusChange(status: ApplicationStatus) {
    if (status === application.status) return;

    setIsUpdatingStatus(true);
    const previous = application;
    onUpdated({ ...application, status });

    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        onStatusRollback(application.id, status, previous);
        showToast(data.error ?? "Failed to update status", "critical");
        return;
      }

      onUpdated(data.application);
      const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
      showToast(`Moved to ${statusLabel}`, "success");
    } catch {
      onStatusRollback(application.id, status, previous);
      showToast("Failed to update status", "critical");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    const response = await fetch(`/api/applications/${application.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setIsDeleting(false);

    if (!response.ok) {
      setIsConfirmingDelete(false);
      setError(data.error ?? "Failed to delete application");
      return;
    }

    onDeleted(application.id);
    showToast("Application removed", "success");
  }

  function startAddRound() {
    setEditingRoundId(null);
    setStageType(interviews.length > 0 ? "panel" : "phone_screen");
    setScheduledDate(getMelbourneDateString());
    setScheduledTime("10:00");
    setIsDeadline(false);
    setLocation("");
    setRoundNotes("");
    setIsAddingRound(true);
  }

  function startEditRound(round: ApplicationInterview) {
    const d = new Date(round.scheduled_at);
    setEditingRoundId(round.id);
    setStageType(round.stage_type);
    setScheduledDate(d.toISOString().slice(0, 10));
    setScheduledTime(d.toTimeString().slice(0, 5));
    setIsDeadline(round.is_deadline);
    setLocation(round.location ?? "");
    setRoundNotes(round.notes ?? "");
    setIsAddingRound(true);
  }

  async function handleSaveRound(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingRound(true);

    try {
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const [year, month, day] = scheduledDate.split("-").map(Number);
      const scheduledDateTime = new Date(Date.UTC(year, month - 1, day, hours || 0, minutes || 0)).toISOString();

      if (editingRoundId) {
        const response = await fetch(
          `/api/applications/${application.id}/interviews/${editingRoundId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stage_type: stageType,
              scheduled_at: scheduledDateTime,
              is_deadline: stageType === "async_video" && isDeadline,
              location: location || null,
              notes: roundNotes || null,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          showToast(data.error ?? "Failed to update interview round", "critical");
          return;
        }

        const updatedList = interviews.map((i) =>
          i.id === editingRoundId ? data.interview : i
        );
        onInterviewsUpdated?.(application.id, updatedList);
        showToast("Interview round updated", "success");
      } else {
        const response = await fetch(`/api/applications/${application.id}/interviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage_type: stageType,
            scheduled_at: scheduledDateTime,
            is_deadline: stageType === "async_video" && isDeadline,
            location: location || null,
            notes: roundNotes || null,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          showToast(data.error ?? "Failed to add interview round", "critical");
          return;
        }

        const updatedList = [...interviews, data.interview];
        onInterviewsUpdated?.(application.id, updatedList);
        if (data.application) {
          onUpdated(data.application);
        }
        showToast("Interview round scheduled", "success");
      }

      setIsAddingRound(false);
      setEditingRoundId(null);
    } catch {
      showToast("Failed to save interview round", "critical");
    } finally {
      setIsSavingRound(false);
    }
  }

  async function handleOutcomeChange(roundId: string, outcome: InterviewOutcome) {
    try {
      const response = await fetch(
        `/api/applications/${application.id}/interviews/${roundId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(data.error ?? "Failed to record outcome", "critical");
        return;
      }

      const updatedList = interviews.map((i) => (i.id === roundId ? data.interview : i));
      onInterviewsUpdated?.(application.id, updatedList);
      showToast(`Interview marked ${outcome}`, "success");
    } catch {
      showToast("Failed to record outcome", "critical");
    }
  }

  async function handleDeleteRound(roundId: string) {
    try {
      const response = await fetch(
        `/api/applications/${application.id}/interviews/${roundId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        showToast("Failed to delete round", "critical");
        return;
      }

      const updatedList = interviews.filter((i) => i.id !== roundId);
      onInterviewsUpdated?.(application.id, updatedList);
      showToast("Interview round removed", "success");
    } catch {
      showToast("Failed to delete round", "critical");
    }
  }

  const practiceLink = `/interview?application=${application.id}${
    soonestRound ? `&stage=${soonestRound.stage_type}&interview=${soonestRound.id}` : ""
  }`;

  const subStage =
    application.status === "interviewing"
      ? classifyInterviewingApplication(application.id, interviews) === "screening"
        ? "Screening"
        : "Interview"
      : null;

  return (
    <div className="group relative flex flex-col gap-2.5 rounded-xl border border-border/90 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
      {/* Header: Company Avatar + Title + Status Badge */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3 min-w-0">
          {/* Company Avatar Monogram */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-bold text-xs shadow-sm ${palette.bg}`}
            title={application.company_name}
          >
            {initials}
          </div>

          {/* Role & Company Name */}
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-[14.5px] font-semibold text-ink leading-snug break-words">
              {application.job_title}
            </h3>
            <span
            className="text-xs font-medium text-ink-secondary truncate mt-0.5"
              title={application.company_name}
            >
              {application.company_name}
            </span>
          </div>
        </div>

        {/* Stage Badge */}
        <Badge
          className="self-start max-w-full min-w-0 text-[11px] font-medium"
          variant={STATUS_BADGE_VARIANT[application.status]}
        >
          <span className="truncate">
            {STATUS_OPTIONS.find((opt) => opt.value === application.status)?.label ?? application.status}
            {subStage && ` · ${subStage}`}
          </span>
        </Badge>
      </div>

      {/* Metadata: Applied Date & Linked Resume */}
      <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-[11.5px] text-ink-muted">
        <div className="flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5 text-ink-muted/70" />
          <span>Applied {new Date(application.applied_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>

        {linkedResume && (
          <div className="flex items-center gap-1 text-ink-secondary truncate max-w-[180px]" title={linkedResume.job_title || "Linked Resume"}>
            <FileTextIcon className="h-3.5 w-3.5 text-ink-muted/70 shrink-0" />
            <span className="truncate">{linkedResume.job_title || "Resume"}</span>
          </div>
        )}
      </div>

      {/* Scheduled Interview Callout Banner */}
      {soonestRound && (
        <div className="mt-0.5 flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-2.5 text-xs text-ink transition-colors">
          {(() => {
            const { formattedDate, formattedTime, relative, isPast } =
              formatInterviewDateTime(soonestRound.scheduled_at, soonestRound.is_deadline);

            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-amber-800">
                      <MicIcon className="h-2.5 w-2.5" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="font-semibold text-ink text-[12px]">
                          {STAGE_LABELS[soonestRound.stage_type] ?? soonestRound.stage_type}
                        </span>
                        <span className="text-ink-secondary text-[11px]">
                          {soonestRound.is_deadline ? `due ${formattedDate}, ${formattedTime}` : `${formattedDate}, ${formattedTime}`}
                        </span>
                      </div>
                      <span className="text-[10.5px] font-medium text-amber-700">
                        {relative}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => startEditRound(soonestRound)}
                    className="shrink-0 text-[11px] font-medium text-ink-muted hover:text-ink hover:underline"
                  >
                    Edit
                  </button>
                </div>

                {soonestRound.location && (
                  <p className="text-[11px] text-ink-secondary pl-5 truncate">
                    📍 {soonestRound.location}
                  </p>
                )}

                {/* Outcome Prompt for Past Rounds */}
                {isPast && (
                  <div className="mt-1 flex flex-col gap-1.5 border-t border-amber-200/60 pt-2 text-[11px]">
                    <span className="font-medium text-ink">Did this round happen?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOutcomeChange(soonestRound.id, "completed")}
                        className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 font-medium text-on-accent transition-transform hover:scale-102 hover:bg-success/90"
                      >
                        <CheckIcon className="h-3 w-3" /> Completed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOutcomeChange(soonestRound.id, "cancelled")}
                        className="inline-flex items-center gap-1 rounded-full bg-paper-deep px-2 py-0.5 font-medium text-ink-secondary hover:bg-border transition-colors"
                      >
                        <XIcon className="h-3 w-3" /> Cancelled
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Extra Rounds Expander */}
      {otherRounds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setShowAllRounds((prev) => !prev)}
            className="self-start text-[11px] font-medium text-accent hover:underline flex items-center gap-1"
          >
            <span>{showAllRounds ? "Hide extra rounds" : `+${otherRounds.length} more round${otherRounds.length > 1 ? "s" : ""}`}</span>
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${showAllRounds ? "rotate-180" : ""}`} />
          </button>

          {showAllRounds && (
            <div className="flex flex-col gap-1.5 border-l-2 border-border/80 pl-2.5 py-1">
              {otherRounds.map((round) => {
                const { formattedDate } = formatInterviewDateTime(
                  round.scheduled_at,
                  round.is_deadline
                );
                return (
                  <div
                    key={round.id}
                    className="flex items-center justify-between text-[11px] text-ink-secondary"
                  >
                    <span>
                      {STAGE_LABELS[round.stage_type]} · {formattedDate} ({round.outcome})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditRound(round)}
                        className="text-ink-muted hover:text-ink hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRound(round.id)}
                        className="text-critical hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Schedule Interview CTA if in Interviewing with no rounds */}
      {application.status === "interviewing" && scheduledRounds.length === 0 && !isAddingRound && (
        <button
          type="button"
          onClick={startAddRound}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong/90 bg-paper/40 px-3 py-2 text-xs font-medium text-ink-secondary transition-all hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
        >
          <ClockIcon className="h-3.5 w-3.5 text-accent" />
          <span>+ Schedule interview round</span>
        </button>
      )}

      {/* Inline Interview Round Form */}
      {isAddingRound && (
        <form
          onSubmit={handleSaveRound}
          className="flex flex-col gap-2.5 rounded-xl border border-border bg-paper p-3 text-xs shadow-sm"
        >
          <div className="font-semibold text-ink text-[12.5px] flex items-center justify-between">
            <span>{editingRoundId ? "Edit interview round" : "Schedule interview round"}</span>
            <button
              type="button"
              onClick={() => {
                setIsAddingRound(false);
                setEditingRoundId(null);
              }}
              className="text-ink-muted hover:text-ink"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-ink-secondary font-medium text-[11px]">Format / Round</label>
            <select
              value={stageType}
              onChange={(e) => setStageType(e.target.value as InterviewStageType)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-ink-secondary font-medium text-[11px]">Date</label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-ink-secondary font-medium text-[11px]">Time</label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {stageType === "async_video" && (
            <label className="flex items-center gap-1.5 text-ink-secondary text-[11px]">
              <input
                type="checkbox"
                checked={isDeadline}
                onChange={(e) => setIsDeadline(e.target.checked)}
                className="rounded border-border text-accent"
              />
              <span>This is a submission deadline (&quot;due by&quot;)</span>
            </label>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-ink-secondary font-medium text-[11px]">Location / Link (optional)</label>
            <input
              type="text"
              placeholder="e.g. Zoom, Google Meet, or Collins St office"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="mt-1 flex items-center justify-end gap-2 pt-1 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAddingRound(false);
                setEditingRoundId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSavingRound}>
              Save round
            </Button>
          </div>
        </form>
      )}

      {/* Notes snippet (if any) */}
      {application.notes && (
        <div className="rounded-lg bg-paper-deep/60 px-2.5 py-1.5 text-[11px] text-ink-secondary italic line-clamp-2">
          &ldquo;{application.notes}&rdquo;
        </div>
      )}

      {/* Card Action Footer Bar */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border/70 pt-2.5 text-xs">
        {/* Quick Links: Listing & Practise */}
        <div className="flex items-center gap-2">
          {application.job_url && (
            <a
              href={application.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-accent hover:bg-accent-soft transition-colors"
              title="View original job listing"
            >
              <span>Listing</span>
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
          <Link
            href={practiceLink}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-ink-secondary hover:text-ink hover:bg-paper-deep transition-colors"
            title="Practice interview questions with AI simulator"
          >
            <span>🎙️ Practise</span>
          </Link>
        </div>

        {/* Stage Selector & Delete */}
        <div className="flex items-center gap-1.5">
          <select
            value={application.status}
            disabled={isUpdatingStatus}
            onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
            aria-label={`Change stage for ${application.job_title}`}
            className="max-w-[120px] rounded-lg border border-border bg-surface px-2 py-1 text-[11.5px] font-medium text-ink hover:border-border-strong focus:border-accent focus:outline-none disabled:opacity-50 transition-colors"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            aria-label={`Delete ${application.job_title} at ${application.company_name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-critical-soft hover:text-critical"
            title="Delete application"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-critical">{error}</p>}

      {isConfirmingDelete && (
        <ConfirmDialog
          title={`Delete application for ${application.job_title}?`}
          description={`This will remove ${application.company_name} from your tracker and delete any scheduled interview rounds.`}
          confirmLabel={isDeleting ? "Deleting…" : "Delete"}
          isDestructive
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
