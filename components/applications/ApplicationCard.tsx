"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatInterviewDateTime, getMelbourneDateString } from "@/lib/dateUtils";
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
  panel: "Panel",
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

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  "neutral" | "accent" | "success" | "attention" | "critical"
> = {
  applied: "neutral",
  interviewing: "accent",
  offer: "success",
  rejected: "critical",
};

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
      // Build ISO timestamp
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const [year, month, day] = scheduledDate.split("-").map(Number);
      const scheduledDateTime = new Date(Date.UTC(year, month - 1, day, hours || 0, minutes || 0)).toISOString();

      if (editingRoundId) {
        // PATCH
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
        // POST
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

  return (
    <div className="flex flex-col gap-2.5 rounded border border-border bg-surface p-4 transition-transform duration-fast ease-editorial hover:-translate-y-px active:translate-y-px">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">{application.job_title}</span>
          <span className="text-sm text-ink-secondary">{application.company_name}</span>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[application.status]}>
          {STATUS_OPTIONS.find((option) => option.value === application.status)?.label ??
            application.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-ink-muted">
        <span>Applied {new Date(application.applied_date).toLocaleDateString("en-AU")}</span>
        {linkedResume && (
          <span className="text-ink-secondary">
            Resume: {linkedResume.job_title || "Untitled"}
          </span>
        )}
      </div>

      {/* Scheduled Interview Round display */}
      {soonestRound && (
        <div className="mt-1 flex flex-col gap-1.5 rounded border border-success/30 bg-success-soft/30 p-2.5 text-xs text-ink">
          {(() => {
            const { formattedDate, formattedTime, relative, isPast } =
              formatInterviewDateTime(soonestRound.scheduled_at, soonestRound.is_deadline);

            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-ink">
                      {STAGE_LABELS[soonestRound.stage_type] ?? soonestRound.stage_type}
                    </span>
                    <span className="text-ink-secondary">
                      {" · "}
                      {soonestRound.is_deadline
                        ? `due by ${formattedDate}, ${formattedTime}`
                        : `${formattedDate}, ${formattedTime}`}
                    </span>
                    <span className="ml-1.5 font-medium text-success">({relative})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditRound(soonestRound)}
                      className="text-[11px] text-ink-muted hover:text-ink hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {soonestRound.location && (
                  <p className="text-[11px] text-ink-secondary">📍 {soonestRound.location}</p>
                )}

                {/* If round in the past and outcome is scheduled -> prompt for outcome */}
                {isPast && (
                  <div className="mt-1 flex items-center justify-between gap-2 border-t border-success/20 pt-1.5 text-[11px]">
                    <span className="font-medium text-ink">How did it go?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOutcomeChange(soonestRound.id, "completed")}
                        className="rounded bg-success px-2 py-0.5 font-medium text-on-accent hover:opacity-90"
                      >
                        Completed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOutcomeChange(soonestRound.id, "cancelled")}
                        className="rounded bg-paper px-2 py-0.5 font-medium text-ink-secondary hover:bg-paper-deep"
                      >
                        Cancelled
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Other rounds expander */}
      {otherRounds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setShowAllRounds((prev) => !prev)}
            className="self-start text-[11px] font-medium text-accent hover:underline"
          >
            {showAllRounds
              ? "Hide extra rounds"
              : `+${otherRounds.length} more round${otherRounds.length > 1 ? "s" : ""}`}
          </button>

          {showAllRounds && (
            <div className="flex flex-col gap-1.5 border-l-2 border-border pl-2.5">
              {otherRounds.map((round) => {
                const { formattedDate, formattedTime } = formatInterviewDateTime(
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

      {/* Ghost Add Interview Date button if interviewing with no rounds */}
      {application.status === "interviewing" && scheduledRounds.length === 0 && !isAddingRound && (
        <button
          type="button"
          onClick={startAddRound}
          className="mt-0.5 flex items-center justify-center gap-1 rounded border border-dashed border-border-strong px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-accent hover:text-accent"
        >
          + Add interview date
        </button>
      )}

      {/* Inline round add/edit form */}
      {isAddingRound && (
        <form
          onSubmit={handleSaveRound}
          className="flex flex-col gap-2 rounded border border-border bg-paper p-3 text-xs"
        >
          <div className="font-medium text-ink">
            {editingRoundId ? "Edit interview round" : "Schedule interview round"}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-ink-secondary">Stage format</label>
            <select
              value={stageType}
              onChange={(e) => setStageType(e.target.value as InterviewStageType)}
              className="rounded border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
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
              <label className="text-ink-secondary">Date</label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-ink-secondary">Time</label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="rounded border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {stageType === "async_video" && (
            <label className="flex items-center gap-1.5 text-ink-secondary">
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
            <label className="text-ink-secondary">Location / Link (optional)</label>
            <input
              type="text"
              placeholder="e.g. Zoom, Google Meet, or Level 4, 120 Collins St"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
            />
          </div>

          <div className="mt-1 flex items-center justify-end gap-2">
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
              Save
            </Button>
          </div>
        </form>
      )}

      {/* Action links */}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
        <div className="flex items-center gap-3">
          {application.job_url && (
            <a
              href={application.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:text-accent-hover hover:underline"
            >
              Listing &rarr;
            </a>
          )}
          <Link
            href={practiceLink}
            className="font-medium text-ink-secondary hover:text-ink hover:underline"
          >
            🎙️ Practise
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={application.status}
            disabled={isUpdatingStatus}
            onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
            className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-ink focus:border-accent focus:outline-none disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmingDelete(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {application.notes && <p className="text-xs text-ink-secondary">{application.notes}</p>}
      {error && <p className="text-xs text-critical">{error}</p>}

      {isConfirmingDelete && (
        <ConfirmDialog
          title={`Remove the application for ${application.job_title}?`}
          confirmLabel={isDeleting ? "Removing…" : "Remove"}
          isDestructive
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
