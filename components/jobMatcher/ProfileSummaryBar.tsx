"use client";

import { Button } from "@/components/ui/Button";
import { PencilIcon } from "@/components/ui/icons/LucideIcons";
import type { ProfileSummary } from "@/lib/jobs/client";

interface ProfileSummaryBarProps {
  profile: ProfileSummary;
  onAdjust: () => void;
  onUseMyProfile: () => void;
}

/** Shows what the matches are based on, so nothing needs to be filled in to get started. */
export function ProfileSummaryBar({ profile, onAdjust, onUseMyProfile }: ProfileSummaryBarProps) {
  const parts = [
    profile.locations.length ? profile.locations.join(", ") : "All of Australia",
    profile.skillCount ? `${profile.skillCount} ${profile.skillCount === 1 ? "skill" : "skills"}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-soft">
      <div className="min-w-0 text-sm">
        <p className="text-ink">
          <span className="text-ink-secondary">Matching you for </span>
          <span className="font-semibold">{profile.targetTitles.length ? profile.targetTitles.join(", ") : "your skills"}</span>
        </p>
        <p className="mt-0.5 text-meta text-ink-muted">
          {parts.join(" · ")}
          {" · "}
          {profile.isAuto ? (
            "Based on your profile and applications"
          ) : (
            <>
              Custom preferences ·{" "}
              <button
                type="button"
                onClick={onUseMyProfile}
                className="rounded-sm font-medium text-ink-secondary underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Use my profile instead
              </button>
            </>
          )}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onAdjust}>
        <PencilIcon className="h-4 w-4" /> Adjust
      </Button>
    </div>
  );
}
