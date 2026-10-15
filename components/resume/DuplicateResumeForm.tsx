"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { JobTitleInput } from "@/components/profile/JobTitleInput";
import { Textarea } from "@/components/ui/Textarea";
import { Reveal } from "@/components/ui/Reveal";
import { useJobAdAutofill } from "@/lib/hooks/useJobAdAutofill";
import { CatalogInput } from "@/components/ui/CatalogInput";
import { COMPANY_CATALOG } from "@/lib/catalogs/companies";

export function DuplicateResumeForm({ sourceResumeId }: { sourceResumeId: string }) {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { titleTouchedRef, companyTouchedRef, handleJobDescriptionPaste, handleJobDescriptionBlur } =
    useJobAdAutofill({ setJobTitle, setCompanyName });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Wrapped so a network failure or non-JSON response (e.g. a platform timeout page) can't
    // leave isSubmitting stuck true forever with no error shown — see ResumeForm.tsx for the
    // production incident this pattern caused.
    try {
      const response = await fetch(`/api/resume/${sourceResumeId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, companyName, jobDescription }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          router.push("/upgrade");
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/resume/${data.resume.id}`);
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Reveal>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
        <Textarea
          id="jobDescription"
          label="Paste the new job ad"
          placeholder="Paste the job ad here…"
          rows={14}
          required
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          onPaste={handleJobDescriptionPaste}
          onBlur={handleJobDescriptionBlur}
        />

        <p className="-mb-2 text-[13.5px] text-ink-secondary">We fill these in from the ad. Fix them if they&apos;re wrong.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <JobTitleInput
            id="jobTitle"
            label="Job title"
            placeholder="e.g. Senior Business Analyst"
            value={jobTitle}
            onValueChange={(value) => {
              titleTouchedRef.current = true;
              setJobTitle(value);
            }}
          />
          <CatalogInput
            id="companyName"
            label="Company"
            placeholder="e.g. Coles Group"
            catalog={COMPANY_CATALOG}
            value={companyName}
            onValueChange={(value) => {
              companyTouchedRef.current = true;
              setCompanyName(value);
            }}
          />
        </div>


        {error && <p className="text-sm text-critical">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Make the new resume
        </Button>
      </form>
    </Reveal>
  );
}
