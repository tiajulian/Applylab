"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export function ResumeForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<{ limit: number } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLimitReached(null);
    setIsGenerating(true);

    const response = await fetch("/api/generate-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle, companyName, jobDescription }),
    });

    const data = await response.json();
    setIsGenerating(false);

    if (!response.ok) {
      if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
        setLimitReached({ limit: data.limit });
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(`/resume/${data.resume.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="jobTitle"
          label="Job title"
          placeholder="e.g. Business Analyst"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
        <Input
          id="companyName"
          label="Company"
          placeholder="e.g. Woolworths Group"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
      </div>

      <Textarea
        id="jobDescription"
        label="Job description"
        placeholder="Paste the full job ad from SEEK here..."
        rows={14}
        required
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {limitReached && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            You&apos;ve used all {limitReached.limit} free resume generations. Upgrade for unlimited
            resumes, cover letters, and downloads.
          </p>
          <Link href="/upgrade" className="self-start">
            <Button type="button" size="sm">
              Upgrade now
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button
          type="submit"
          isLoading={isGenerating}
          disabled={disabled || !!limitReached}
          className="self-start"
        >
          Generate resume
        </Button>
        {disabled && (
          <p className="text-sm text-gray-500">Finish the required profile fields above to generate.</p>
        )}
      </div>
    </form>
  );
}
