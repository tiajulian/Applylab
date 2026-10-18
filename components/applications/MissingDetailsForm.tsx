"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Application } from "@/types";

/**
 * Shown on an application saved without a real job title or company (e.g. by an older Chrome
 * extension build reading an ATS apply page): asks the user to fill them in, rather than showing
 * "Manual application" / "Company" as if they were real.
 */
export function MissingDetailsForm({
  application,
  jobTitle,
  companyName,
  onUpdated,
}: {
  application: Application;
  /** The cleaned values: "" where the stored one is missing or a placeholder. */
  jobTitle: string;
  companyName: string;
  onUpdated: (application: Application) => void;
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
    } catch (error) {
      showToast((error as Error).message || "Couldn't save. Try again.", "critical");
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    "h-8 w-full rounded-md border border-border bg-surface px-2 text-[12.5px] text-ink focus:border-accent focus:outline-none";

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-lg border border-attention/40 bg-attention-soft/40 p-2.5">
      <p className="text-[12px] font-medium text-ink">Confirm the job details</p>
      <label className="flex flex-col gap-1 text-[11.5px] text-ink-secondary">
        Job title
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-[11.5px] text-ink-secondary">
        Company
        <input required value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
      </label>
      <Button type="submit" size="sm" isLoading={isSaving} disabled={!title.trim() || !company.trim()} className="self-end">
        Save details
      </Button>
    </form>
  );
}
