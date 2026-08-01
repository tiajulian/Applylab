"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
  onDeleted,
}: {
  application: Application;
  resumes: ResumeOption[];
  onUpdated: (application: Application) => void;
  onDeleted: (id: string) => void;
}) {
  const { showToast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedResume = application.resume_id
    ? resumes.find((resume) => resume.id === application.resume_id)
    : null;

  async function handleStatusChange(status: ApplicationStatus) {
    setIsUpdatingStatus(true);
    setError(null);

    const response = await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const data = await response.json().catch(() => ({}));
    setIsUpdatingStatus(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to update status");
      return;
    }

    onUpdated(data.application);
    const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
    showToast(`Moved to ${statusLabel}`, "success");
  }

  async function handleDelete() {
    if (!window.confirm(`Remove the application for ${application.job_title}?`)) return;

    setIsDeleting(true);
    setError(null);

    const response = await fetch(`/api/applications/${application.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setIsDeleting(false);

    if (!response.ok) {
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
        <Button type="button" variant="ghost" size="sm" onClick={handleDelete} isLoading={isDeleting}>
          Delete
        </Button>
      </div>

      {error && <p className="text-xs text-critical">{error}</p>}
    </div>
  );
}
