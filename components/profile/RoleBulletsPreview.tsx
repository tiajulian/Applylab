import type { WorkExperienceWin } from "@/types";

/**
 * Read-only "everything that will feed this role's bullets" preview: the raw description, wins,
 * and confirmed duties, shown together but never merged into one field. Each source stays its own
 * structured record (see WinsField.tsx, RoleDutiesReview.tsx) - this is purely a display surface
 * so the candidate can see what's captured without re-entering it, and it must never be editable
 * here or feed generation itself (see buildUserMessage in lib/anthropic/generateResume.ts, which
 * reads description, wins, and confirmed duties as three separate labelled sections already, so
 * this preview repeating them on screen creates no duplicate content in the actual prompt).
 */
export function RoleBulletsPreview({
  description,
  wins,
  confirmedDuties,
}: {
  description: string;
  wins: WorkExperienceWin[];
  confirmedDuties: string[];
}) {
  const hasDescription = description.trim().length > 0;
  const hasWins = wins.length > 0;
  const hasDuties = confirmedDuties.length > 0;

  if (!hasDescription && !hasWins && !hasDuties) return null;

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-paper-deep/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">Your bullets so far</p>
      <p className="text-xs text-ink-muted">
        Everything below is used to write this role&apos;s bullets. Read-only here, edit each part where
        it was added above.
      </p>
      {hasDescription && (
        <p className="whitespace-pre-line text-sm text-ink-secondary">{description.trim()}</p>
      )}
      {(hasWins || hasDuties) && (
        <ul className="flex flex-col gap-1 text-sm text-ink-secondary">
          {wins.map((win, index) => (
            <li key={`win-${index}`} className="flex gap-1.5">
              <span aria-hidden="true">•</span>
              <span>
                {win.text}
                {win.metric && <span className="text-ink-muted">, {win.metric}</span>}
              </span>
            </li>
          ))}
          {confirmedDuties.map((duty, index) => (
            <li key={`duty-${index}`} className="flex gap-1.5">
              <span aria-hidden="true">•</span>
              <span>{duty}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
