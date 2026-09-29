"use client";

import { Button } from "@/components/ui/Button";
import { MapPinIcon, SlidersHorizontalIcon } from "@/components/ui/icons/LucideIcons";
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

/** What the matches are based on, so nothing needs filling in to get started. */
export function ProfileSummaryBar({ profile, onAdjust, onUseMyProfile }: ProfileSummaryBarProps) {
  const skills = profile.skillCount ? `${profile.skillCount} ${profile.skillCount === 1 ? "skill" : "skills"}` : null;

  return (
    <section aria-labelledby="your-search" className="rounded-lg border border-border bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 id="your-search" className="text-sm font-medium text-ink-secondary">
          Your search
        </h2>
        <Button variant="secondary" size="sm" onClick={onAdjust}>
          <SlidersHorizontalIcon className="h-4 w-4" aria-hidden="true" /> Adjust
        </Button>
      </div>
      <div className="min-w-0">
        {profile.targetTitles.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Job titles">
            {profile.targetTitles.map((title) => (
              <li key={title} className="rounded-pill border border-border bg-paper px-3 py-1 text-sm font-medium text-ink">
                {title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-medium text-ink">Jobs that fit your skills</p>
        )}
        <p className="mt-3 text-meta text-ink-muted">
          <MapPinIcon className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5 align-middle" aria-hidden="true" />
          {[describeArea(profile), skills].filter(Boolean).join(" · ")}
          {" · "}
          {profile.isAuto ? (
            "From your profile and applications"
          ) : (
            <>
              Custom search ·{" "}
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
    </section>
  );
}
