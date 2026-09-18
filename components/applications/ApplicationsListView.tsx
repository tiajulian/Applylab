"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  CalendarIcon,
  MicIcon,
  ExternalLinkIcon,
  TrashIcon,
  FileTextIcon,
  BriefcaseIcon,
} from "@/components/ui/icons/LucideIcons";
import { formatInterviewDateTime } from "@/lib/dateUtils";
import { classifyInterviewingApplication } from "@/lib/dashboard/pipeline";
import { STATUS_OPTIONS, STATUS_BADGE_VARIANT } from "@/lib/applications/stageLabels";
import { STAGE_LABELS } from "@/components/applications/ApplicationCard";
import type { ResumeOption } from "@/components/applications/ApplicationsBoard";
import type { Application, ApplicationStatus, ApplicationInterview } from "@/types";

function getCompanyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CO";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  { bg: "bg-orange-100 text-orange-700 border-orange-200" },
  { bg: "bg-amber-100 text-amber-700 border-amber-200" },
  { bg: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { bg: "bg-blue-100 text-blue-700 border-blue-200" },
  { bg: "bg-purple-100 text-purple-700 border-purple-200" },
  { bg: "bg-rose-100 text-rose-700 border-rose-200" },
  { bg: "bg-teal-100 text-teal-700 border-teal-200" },
];

function getCompanyColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function ApplicationsListView({
  applications,
  resumes,
  interviewsByAppId,
  onUpdated,
  onStatusRollback,
  onDeleted,
}: {
  applications: Application[];
  resumes: ResumeOption[];
  interviewsByAppId: Map<string, ApplicationInterview[]>;
  onUpdated: (application: Application) => void;
  onStatusRollback: (id: string, expectedStatus: ApplicationStatus, revertTo: Application) => void;
  onDeleted: (id: string) => void;
  onInterviewsUpdated?: (applicationId: string, interviews: ApplicationInterview[]) => void;
}) {
  const { showToast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleStatusChange(application: Application, nextStatus: ApplicationStatus) {
    if (nextStatus === application.status) return;

    const previous = application;
    onUpdated({ ...application, status: nextStatus });

    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        onStatusRollback(application.id, nextStatus, previous);
        showToast(data.error ?? "Failed to update status", "critical");
        return;
      }

      onUpdated(data.application);
      const statusLabel = STATUS_OPTIONS.find((opt) => opt.value === nextStatus)?.label ?? nextStatus;
      showToast(`Moved to ${statusLabel}`, "success");
    } catch {
      onStatusRollback(application.id, nextStatus, previous);
      showToast("Failed to update status", "critical");
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/applications/${deletingId}`, { method: "DELETE" });
      setIsDeleting(false);

      if (!response.ok) {
        showToast("Failed to delete application", "critical");
        return;
      }

      onDeleted(deletingId);
      setDeletingId(null);
      showToast("Application deleted", "success");
    } catch {
      setIsDeleting(false);
      showToast("Failed to delete application", "critical");
    }
  }

  const appToDelete = applications.find((a) => a.id === deletingId);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="border-b border-border bg-paper-deep/50 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="py-3.5 pl-5 pr-4">Role & Company</th>
                <th className="py-3.5 px-4">Stage</th>
                <th className="py-3.5 px-4">Next Round / Schedule</th>
                <th className="py-3.5 px-4">Applied</th>
                <th className="py-3.5 pl-4 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {applications.map((app) => {
                const appInterviews = interviewsByAppId.get(app.id) ?? [];
                const scheduledRounds = appInterviews
                  .filter((i) => i.outcome === "scheduled")
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                const soonestRound = scheduledRounds[0];

                const initials = getCompanyInitials(app.company_name);
                const palette = getCompanyColor(app.company_name);
                const linkedResume = app.resume_id ? resumes.find((r) => r.id === app.resume_id) : null;

                const subStage =
                  app.status === "interviewing"
                    ? classifyInterviewingApplication(app.id, appInterviews) === "screening"
                      ? "Screening"
                      : "Interview"
                    : null;

                const practiceLink = `/interview?application=${app.id}${
                  soonestRound ? `&stage=${soonestRound.stage_type}&interview=${soonestRound.id}` : ""
                }`;

                return (
                  <tr key={app.id} className="transition-colors hover:bg-paper/70">
                    {/* Role & Company */}
                    <td className="py-3.5 pl-5 pr-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-bold text-xs ${palette.bg}`}
                        >
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-ink text-[14px] leading-tight truncate">
                            {app.job_title}
                          </span>
                          <span className="text-xs text-ink-secondary truncate mt-0.5">
                            {app.company_name}
                          </span>
                          {linkedResume && (
                            <span className="mt-1 flex items-center gap-1 text-[11px] text-ink-muted truncate">
                              <FileTextIcon className="h-3 w-3" />
                              {linkedResume.job_title || "Linked Resume"}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Stage & Selector */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 items-start">
                        <Badge variant={STATUS_BADGE_VARIANT[app.status]} className="text-[11px]">
                          {STATUS_OPTIONS.find((opt) => opt.value === app.status)?.label ?? app.status}
                          {subStage && ` · ${subStage}`}
                        </Badge>
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app, e.target.value as ApplicationStatus)}
                          className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-ink-secondary hover:text-ink focus:border-accent focus:outline-none"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Next Round */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                      {soonestRound ? (
                        (() => {
                          const { formattedDate, formattedTime, relative } = formatInterviewDateTime(
                            soonestRound.scheduled_at,
                            soonestRound.is_deadline
                          );
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium text-ink">
                                {STAGE_LABELS[soonestRound.stage_type] ?? soonestRound.stage_type}
                              </span>
                              <span className="text-xs text-ink-secondary">
                                {formattedDate}, {formattedTime}
                              </span>
                              <span className="text-[11px] font-medium text-amber-700">
                                {relative}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </td>

                    {/* Applied Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-ink-secondary">
                      {new Date(app.applied_date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {app.job_url && (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft transition-colors"
                            title="View job posting"
                          >
                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                          </a>
                        )}

                        <Link
                          href={practiceLink}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-paper transition-colors"
                          title="Practice interview"
                        >
                          <span>🎙️ Practise</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => setDeletingId(app.id)}
                          aria-label={`Delete ${app.job_title}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-critical-soft hover:text-critical"
                          title="Delete application"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {appToDelete && (
        <ConfirmDialog
          title={`Delete application for ${appToDelete.job_title}?`}
          description={`This will remove ${appToDelete.company_name} from your applications list.`}
          confirmLabel={isDeleting ? "Deleting…" : "Delete"}
          isDestructive
          isConfirming={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
