"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { XIcon, BriefcaseIcon, Building2Icon, CalendarIcon } from "@/components/ui/icons/LucideIcons";
import { STATUS_OPTIONS } from "@/lib/applications/stageLabels";
import type { ResumeOption } from "@/components/applications/ApplicationsBoard";
import type { Application, ApplicationStatus } from "@/types";

function todayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resumeLabel(resume: ResumeOption): string {
  return `${resume.job_title || "Untitled role"} at ${resume.company_name || "Unknown company"}`;
}

export function AddApplicationModal({
  isOpen,
  onClose,
  onCreated,
  resumes,
  defaultStatus = "applied",
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (application: Application) => void;
  resumes: ResumeOption[];
  defaultStatus?: ApplicationStatus;
}) {
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>(defaultStatus);
  const [appliedDate, setAppliedDate] = useState(() => todayLocalDateString());
  const [jobUrl, setJobUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ companyName?: string; jobTitle?: string }>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Sync defaultStatus when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus(defaultStatus);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultStatus]);

  // Keyboard escape handler
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleDismiss();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, companyName, jobTitle, jobUrl, notes, resumeId]);

  function resetForm() {
    setCompanyName("");
    setJobTitle("");
    setStatus(defaultStatus);
    setAppliedDate(todayLocalDateString());
    setJobUrl("");
    setNotes("");
    setResumeId("");
    setError(null);
    setFieldErrors({});
  }

  function handleDismiss() {
    resetForm();
    onClose();
  }

  function handleResumeSelect(id: string) {
    setResumeId(id);
    const resume = resumes.find((r) => r.id === id);
    if (resume) {
      if (resume.company_name) setCompanyName(resume.company_name);
      if (resume.job_title) setJobTitle(resume.job_title);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const nextFieldErrors: { companyName?: string; jobTitle?: string } = {};
    if (!companyName.trim()) nextFieldErrors.companyName = "Company name is required";
    if (!jobTitle.trim()) nextFieldErrors.jobTitle = "Job title is required";
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          job_title: jobTitle.trim(),
          status,
          applied_date: appliedDate,
          job_url: jobUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          resume_id: resumeId || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      setIsSubmitting(false);

      if (!response.ok) {
        setError(data.error ?? "Failed to add application");
        return;
      }

      onCreated(data.application);
      resetForm();
      onClose();
    } catch {
      setIsSubmitting(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Modal Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-application-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 sm:p-7 shadow-pop z-10 my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <BriefcaseIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="add-application-title" className="font-display text-lg font-semibold text-ink">
                    Add application
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Track a job opening you&apos;ve applied to or are preparing for.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close dialog"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              {/* Linked Resume */}
              {resumes.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-paper/60 p-3">
                  <label htmlFor="modalResumeId" className="text-xs font-semibold text-ink-secondary">
                    Autofill from tailored resume (optional)
                  </label>
                  <select
                    id="modalResumeId"
                    value={resumeId}
                    onChange={(e) => handleResumeSelect(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">Choose a resume to auto-fill details...</option>
                    {resumes.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resumeLabel(resume)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Company & Role */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  ref={firstInputRef}
                  id="modalCompanyName"
                  label="Company"
                  placeholder="e.g. Canva, Atlassian"
                  required
                  error={fieldErrors.companyName}
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (fieldErrors.companyName) setFieldErrors((prev) => ({ ...prev, companyName: undefined }));
                  }}
                />
                <Input
                  id="modalJobTitle"
                  label="Job title"
                  placeholder="e.g. Senior Product Designer"
                  required
                  error={fieldErrors.jobTitle}
                  value={jobTitle}
                  onChange={(e) => {
                    setJobTitle(e.target.value);
                    if (fieldErrors.jobTitle) setFieldErrors((prev) => ({ ...prev, jobTitle: undefined }));
                  }}
                />
              </div>

              {/* Status & Applied Date */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="modalStatus" className="text-xs font-medium text-ink-secondary">
                    Initial Stage
                  </label>
                  <select
                    id="modalStatus"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  id="modalAppliedDate"
                  type="date"
                  label="Date applied"
                  value={appliedDate}
                  onChange={(e) => setAppliedDate(e.target.value)}
                />
              </div>

              {/* Job Listing URL */}
              <Input
                id="modalJobUrl"
                label="Job listing URL (optional)"
                placeholder="https://linkedin.com/jobs/..."
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
              />

              {/* Notes */}
              <Textarea
                id="modalNotes"
                label="Notes & salary/interviewer details (optional)"
                placeholder="Key requirements, referral info, salary band, etc."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {error && (
                <div className="rounded-lg bg-critical-soft/50 border border-critical/20 p-2.5 text-xs text-critical">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="mt-2 flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
                <Button type="button" variant="ghost" size="sm" onClick={handleDismiss} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmitting}>
                  Add application
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
