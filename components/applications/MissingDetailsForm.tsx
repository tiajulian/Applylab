"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Application } from "@/types";

/**
 * Opened from the "Add job title" / "Add company" prompt on an application saved without one
 * (e.g. by an older Chrome extension build reading an ATS apply page). Only the missing fields
 * are shown; the ones already known are sent back unchanged.
 */
export function MissingDetailsForm({
  application,
  jobTitle,
  companyName,
  onUpdated,
  onCancel,
}: {
  application: Application;
  /** The cleaned values: "" where the stored one is missing or a placeholder. */
  jobTitle: string;
  companyName: string;
  onUpdated: (application: Application) => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(jobTitle);
  const [company, setCompany] = useState(companyName);
  const [isSaving, setIsSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_title: title.trim(), company_name: company.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      onUpdated(data.application);
      onCancel();
    } catch (error) {
      showToast((error as Error).message || "Couldn't save. Try again.", "critical");
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    "h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-[12.5px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none";

  return (
    <form
      onSubmit={save}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="flex flex-col gap-2 rounded-xl border border-border bg-paper p-2.5"
    >
      {!jobTitle && (
        <input
          autoFocus
          required
          aria-label="Job title"
          placeholder="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      )}
      {!companyName && (
        <input
          autoFocus={!!jobTitle}
          required
          aria-label="Company"
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={inputClass}
        />
      )}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={isSaving} disabled={!title.trim() || !company.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}
