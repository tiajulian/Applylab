"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import type { Application, ApplicationStatus, ApplicationInterview } from "@/types";

export type ResumeOption = { id: string; job_title: string | null; company_name: string | null };

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: "applied", label: "Applied" },
  { status: "interviewing", label: "Interviewing" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

function resumeLabel(resume: ResumeOption): string {
  return `${resume.job_title || "Untitled role"} at ${resume.company_name || "Unknown company"}`;
}

// Local calendar date (YYYY-MM-DD) for the date input's default.
function todayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ApplicationsBoard({
  initialApplications,
  resumes,
  initialInterviews = [],
}: {
  initialApplications: Application[];
  resumes: ResumeOption[];
  initialInterviews?: ApplicationInterview[];
}) {
  const searchParams = useSearchParams();
  const initialStageFilter = searchParams?.get("stage") ?? "all";

  const [applications, setApplications] = useState(initialApplications);
  const [interviews, setInterviews] = useState(initialInterviews);
  const [selectedStage, setSelectedStage] = useState<string>(initialStageFilter);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [appliedDate, setAppliedDate] = useState(() => todayLocalDateString());
  const [jobUrl, setJobUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interviewsByAppId = useMemo(() => {
    const map = new Map<string, ApplicationInterview[]>();
    for (const interview of interviews) {
      const list = map.get(interview.application_id) ?? [];
      list.push(interview);
      map.set(interview.application_id, list);
    }
    return map;
  }, [interviews]);

  function handleResumeSelect(id: string) {
    setResumeId(id);
    const resume = resumes.find((r) => r.id === id);
    if (resume) {
      if (resume.company_name) setCompanyName(resume.company_name);
      if (resume.job_title) setJobTitle(resume.job_title);
    }
  }

  function resetForm() {
    setCompanyName("");
    setJobTitle("");
    setAppliedDate(todayLocalDateString());
    setJobUrl("");
    setNotes("");
    setResumeId("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: companyName,
        job_title: jobTitle,
        applied_date: appliedDate,
        job_url: jobUrl || undefined,
        notes: notes || undefined,
        resume_id: resumeId || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to add application");
      return;
    }

    setApplications((prev) => [data.application, ...prev]);
    resetForm();
    setIsFormOpen(false);
  }

  function handleUpdated(updated: Application) {
    setApplications((prev) =>
      prev.map((application) => (application.id === updated.id ? updated : application))
    );
  }

  function handleStatusRollback(
    id: string,
    expectedStatus: ApplicationStatus,
    revertTo: Application
  ) {
    setApplications((prev) =>
      prev.map((application) =>
        application.id === id && application.status === expectedStatus ? revertTo : application
      )
    );
  }

  function handleDeleted(id: string) {
    setApplications((prev) => prev.filter((application) => application.id !== id));
    setInterviews((prev) => prev.filter((interview) => interview.application_id !== id));
  }

  function handleInterviewsUpdated(applicationId: string, updatedList: ApplicationInterview[]) {
    setInterviews((prev) => {
      const others = prev.filter((i) => i.application_id !== applicationId);
      return [...others, ...updatedList];
    });
  }

  const visibleColumns = COLUMNS.filter((col) => {
    if (selectedStage === "all") return true;
    if (selectedStage === "screening" || selectedStage === "interview") {
      return col.status === "interviewing";
    }
    return col.status === selectedStage;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsFormOpen((open) => !open)}
          >
            {isFormOpen ? "Cancel" : "Add application"}
          </Button>
        </div>

        {/* Optional quick stage filter */}
        <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <span>Filter:</span>
          {["all", "applied", "interviewing", "offer", "rejected"].map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setSelectedStage(stage)}
              className={`rounded px-2 py-1 font-medium transition-colors ${
                selectedStage === stage
                  ? "bg-accent text-on-accent"
                  : "bg-surface text-ink hover:bg-paper-deep"
              }`}
            >
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded border border-border bg-surface p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="companyName"
              label="Company"
              placeholder="e.g. Coles Group"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              id="jobTitle"
              label="Job title"
              placeholder="e.g. Senior Business Analyst"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            <Input
              id="appliedDate"
              type="date"
              label="Applied on"
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
            />
            <Input
              id="jobUrl"
              label="Job listing URL (optional)"
              placeholder="https://..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
          </div>

          {resumes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="resumeId" className="text-sm font-medium text-ink-secondary">
                Linked resume (optional)
              </label>
              <select
                id="resumeId"
                value={resumeId}
                onChange={(e) => handleResumeSelect(e.target.value)}
                className="rounded border border-border bg-surface px-3.5 py-2.5 text-sm text-ink transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">None</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resumeLabel(resume)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-muted">
                Selecting a resume fills in the company and job title below. You can still edit them.
              </p>
            </div>
          )}

          <Textarea
            id="notes"
            label="Notes (optional)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && <p className="text-sm text-critical">{error}</p>}

          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Add application
          </Button>
        </form>
      )}

      <StaggerList
        className={`grid gap-4 ${
          visibleColumns.length === 1
            ? "grid-cols-1"
            : visibleColumns.length === 2
            ? "sm:grid-cols-2"
            : "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {visibleColumns.map((column) => {
          const colApps = applications.filter((app) => app.status === column.status);
          return (
            <StaggerItem key={column.status} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {column.label} ({colApps.length})
              </h2>
              <div className="flex flex-col gap-3">
                {colApps.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    resumes={resumes}
                    interviews={interviewsByAppId.get(application.id) ?? []}
                    onUpdated={handleUpdated}
                    onStatusRollback={handleStatusRollback}
                    onDeleted={handleDeleted}
                    onInterviewsUpdated={handleInterviewsUpdated}
                  />
                ))}
                {colApps.length === 0 && (
                  <div className="rounded border border-dashed border-border p-4 text-center text-xs text-ink-muted">
                    No applications in {column.label.toLowerCase()}
                  </div>
                )}
              </div>
            </StaggerItem>
          );
        })}
      </StaggerList>
    </div>
  );
}
