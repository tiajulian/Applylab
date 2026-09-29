"use client";

import { Button } from "@/components/ui/Button";
import { PencilIcon } from "@/components/ui/icons/LucideIcons";
import type { ProfileSummary } from "@/lib/jobs/client";
import { STATES } from "@/lib/jobs/places";

const STATE_NAMES = new Set(Object.values(STATES));

/** "Within 50 km of Kogarah or Melbourne or anywhere in Queensland" - states have no centre point. */
function describeArea({ locations, radiusKm }: ProfileSummary): string {
  if (locations.length === 0 || radiusKm === null) return "Anywhere in Australia";
  const places = locations.filter((l) => !STATE_NAMES.has(l));
  const states = locations.filter((l) => STATE_NAMES.has(l));
  const text = [
    places.length ? `within ${radiusKm} km of ${places.join(" or ")}` : null,
    states.length ? `anywhere in ${states.join(" or ")}` : null,
  ]
    .filter(Boolean)
    .join(" or ");
  return text[0].toUpperCase() + text.slice(1);
}

interface ProfileSummaryBarProps {
  profile: ProfileSummary;
  onAdjust: () => void;
  onUseMyProfile: () => void;
}

/** Shows what the matches are based on, so nothing needs to be filled in to get started. */
export function ProfileSummaryBar({ profile, onAdjust, onUseMyProfile }: ProfileSummaryBarProps) {
  const parts = [
    describeArea(profile),
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
