"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export function DuplicateResumeForm({ sourceResumeId }: { sourceResumeId: string }) {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Something went wrong — the request may have timed out. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="jobTitle"
          label="New job title"
          placeholder="e.g. Senior Business Analyst"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />
        <Input
          id="companyName"
          label="New company"
          placeholder="e.g. Coles Group"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
      </div>

      <Textarea
        id="jobDescription"
        label="New job description"
        placeholder="Paste the full job ad from SEEK here..."
        rows={14}
        required
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        Duplicate &amp; tailor
      </Button>
    </form>
  );
}
