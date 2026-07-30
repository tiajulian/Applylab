"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ResumeOption } from "@/components/applications/ApplicationsBoard";
import type { Application, ApplicationStatus } from "@/types";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

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
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{application.job_title}</span>
        <span className="text-sm text-gray-500">{application.company_name}</span>
      </div>

      <span className="text-xs text-gray-400">
        Applied {new Date(application.applied_date).toLocaleDateString("en-AU")}
      </span>

      {linkedResume && <span className="text-xs text-gray-400">Resume: {linkedResume.job_title || "Untitled role"}</span>}

      {application.job_url && (
        <a
          href={application.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          View listing
        </a>
      )}

      {application.notes && <p className="text-xs text-gray-500">{application.notes}</p>}

      <div className="mt-1 flex items-center justify-between gap-2">
        <select
          value={application.status}
          disabled={isUpdatingStatus}
          onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
