"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { ResumeOption } from "@/components/applications/ApplicationsBoard";
import type { Application, ApplicationStatus } from "@/types";

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
  onUpdated,
  onStatusRollback,
  onDeleted,
}: {
  application: Application;
  resumes: ResumeOption[];
  onUpdated: (application: Application) => void;
  onStatusRollback: (id: string, expectedStatus: ApplicationStatus, revertTo: Application) => void;
  onDeleted: (id: string) => void;
}) {
  const { showToast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedResume = application.resume_id
    ? resumes.find((resume) => resume.id === application.resume_id)
    : null;

  async function handleStatusChange(status: ApplicationStatus) {
    if (status === application.status) return;

    setIsUpdatingStatus(true);

    // Optimistic: move the card to its new column straight away rather than waiting on the round
    // trip, so the change reads as instant. Rolled back below if the write fails.
    //
    // This moves the card into a different column's list, which unmounts this component instance
    // and mounts a fresh one for the new column - so on failure, this function keeps running
    // against a component that's already gone. Local state (setError, setIsUpdatingStatus) is a
    // no-op on an unmounted instance and would never reach the user; a toast and the shared
    // onStatusRollback (keyed off the request's own expected status, not this closure's state)
    // are used instead since both are independent of this instance's lifecycle.
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

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-surface p-4 transition-transform duration-fast ease-editorial hover:-translate-y-px active:translate-y-px">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">{application.job_title}</span>
          <span className="text-sm text-ink-secondary">{application.company_name}</span>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[application.status]}>
          {STATUS_OPTIONS.find((option) => option.value === application.status)?.label ?? application.status}
        </Badge>
      </div>

      <span className="text-xs text-ink-muted">
        Applied {new Date(application.applied_date).toLocaleDateString("en-AU")}
      </span>

      {linkedResume && <span className="text-xs text-ink-muted">Resume: {linkedResume.job_title || "Untitled role"}</span>}

      {application.job_url && (
        <a
          href={application.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View listing
        </a>
      )}

      {application.notes && <p className="text-xs text-ink-secondary">{application.notes}</p>}

      <div className="mt-1 flex items-center justify-between gap-2">
        <select
          value={application.status}
          disabled={isUpdatingStatus}
          onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
          className="rounded border border-border bg-surface px-2 py-1 text-xs text-ink transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsConfirmingDelete(true)}>
          Delete
        </Button>
      </div>

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
