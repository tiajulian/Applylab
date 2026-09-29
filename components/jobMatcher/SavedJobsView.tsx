"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { JobCard } from "@/components/jobMatcher/JobCard";
import { addInteraction, getSavedJobs, removeInteraction, type SavedJob } from "@/lib/jobs/client";

export function SavedJobsView() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<SavedJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setJobs(null);
    setError(null);
    getSavedJobs().then(
      (response) => !cancelled && setJobs(response.jobs),
      (err: Error) => !cancelled && setError(err.message)
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function unsave(saved: SavedJob, index: number) {
    setJobs((current) => current && current.filter((j) => j.job.id !== saved.job.id));
    try {
      await removeInteraction(saved.job.id, "saved");
    } catch {
      setJobs((current) => current && [...current.slice(0, index), saved, ...current.slice(index)]);
      showToast("Couldn't remove that job. Try again.", "critical");
    }
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
        <p className="text-sm text-ink-secondary">We couldn&apos;t load your saved jobs. {error}</p>
        <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!jobs) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading saved jobs">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
        <h2 className="text-h3 font-semibold text-ink">No saved jobs yet</h2>
        <p className="max-w-sm text-sm text-ink-secondary">Save jobs from your matches to keep them here.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {jobs.map((saved, index) => (
        <li key={saved.job.id}>
          <JobCard
            job={saved.job}
            saved
            expired={!saved.isActive}
            onToggleSave={() => unsave(saved, index)}
            onApply={() => void addInteraction(saved.job.id, "applied_click").catch(() => {})}
          />
        </li>
      ))}
    </ul>
  );
}
