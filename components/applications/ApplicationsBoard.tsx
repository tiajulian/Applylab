"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import type { Application, ApplicationStatus } from "@/types";

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

export function ApplicationsBoard({
  initialApplications,
  resumes,
}: {
  initialApplications: Application[];
  resumes: ResumeOption[];
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [appliedDate, setAppliedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [jobUrl, setJobUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setCompanyName("");
    setJobTitle("");
    setAppliedDate(new Date().toISOString().slice(0, 10));
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
    setApplications((prev) => prev.map((application) => (application.id === updated.id ? updated : application)));
  }

  function handleDeleted(id: string) {
    setApplications((prev) => prev.filter((application) => application.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen((open) => !open)}>
          {isFormOpen ? "Cancel" : "Add application"}
        </Button>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6"
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
            <div className="flex flex-col gap-1">
              <label htmlFor="resumeId" className="text-sm font-medium text-gray-700">
                Linked resume (optional)
              </label>
              <select
                id="resumeId"
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">None</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resumeLabel(resume)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Textarea
            id="notes"
            label="Notes (optional)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Add application
          </Button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((column) => (
          <div key={column.status} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-500">
              {column.label} (
              {applications.filter((application) => application.status === column.status).length})
            </h2>
            <div className="flex flex-col gap-3">
              {applications
                .filter((application) => application.status === column.status)
                .map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    resumes={resumes}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
