"use client";

import { ReactNode, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { MonthYearField } from "@/components/profile/MonthYearField";
import { RoleContentList } from "@/components/profile/RoleContentList";
import { OriginalTasksList } from "@/components/profile/OriginalTasksList";
import { isRoleEntryEmpty, isWinEmpty } from "@/lib/profile/emptyEntry";
import { isThinExperience } from "@/lib/profile/thinExperience";
import { useRoleDuties } from "@/lib/profile/useRoleDuties";
import type { WorkExperienceRow } from "@/lib/profile/useProfileFieldsState";

function dateRange(entry: WorkExperienceRow): string {
  const end = entry.is_current ? "Present" : entry.end_date;
  const parts = [entry.start_date, end].filter(Boolean);
  return parts.join(" - ");
}

/** Shared by the fully-collapsed card and the details-collapsed summary row below - both show the
 * same title + "company · date range" line, just inside a different wrapper element. */
function RoleSummaryText({ title, summaryLine }: { title: string; summaryLine: string }) {
  return (
    <>
      <span className="block truncate text-sm font-medium text-ink">{title}</span>
      {summaryLine && <span className="block truncate text-xs text-ink-secondary">{summaryLine}</span>}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 text-ink-muted transition-transform duration-fast ease-editorial ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One work-experience role. Collapsed, it is a single summary row so a candidate with several
 * roles sees a scannable list rather than every role's full editor at once (see build brief -
 * "Progressive disclosure"). Only one role is expanded at a time, controlled by the parent
 * (ProfileFieldsFieldset.tsx) so opening a new one always closes the last.
 */
export function RoleCard({
  entry,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  canRemove,
  tools,
  onAddTool,
  stakeholders,
  onAddStakeholder,
  messagesFor,
}: {
  entry: WorkExperienceRow;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<WorkExperienceRow>) => void;
  /** `hasContent` tells the caller whether this role has anything worth confirming before it's
   * removed (see isRoleEntryEmpty below) - a role added via "+ Add role" and never touched can
   * skip the confirm and just go. */
  onRemove: (hasContent: boolean) => void;
  canRemove: boolean;
  tools: string[];
  onAddTool: (tool: string) => void;
  stakeholders: string[];
  onAddStakeholder: (stakeholder: string) => void;
  messagesFor: (field: string) => ReactNode;
}) {
  // Starts collapsed once a role already has a title and company - editing an existing role
  // shouldn't have to scroll past its own fields to reach the achievements below. A brand-new
  // role (added via "+ Add role") starts open since there's nothing to summarise yet.
  const [detailsOpen, setDetailsOpen] = useState(() => !(entry.job_title.trim() && entry.company.trim()));
  // Instantiated for every role regardless of expand state, matching the pre-redesign behaviour
  // where RoleDutiesReview's own zero-cost "already saved?" lookup ran for every role on page
  // load, not only the one open at the time.
  const duties = useRoleDuties({ jobTitle: entry.job_title, isThin: isThinExperience(entry) });
  // Same "does this role actually have an achievement" test as RoleContentList's own count (a
  // blank draft win from "Write an achievement" doesn't count until it has content), so the
  // collapsed-card dot below never disagrees with what "Achievements" shows once reopened.
  const hasAchievements =
    entry.wins.some((win) => !isWinEmpty(win)) || duties.items.some((item) => item.user_state === "confirmed");
  const title = entry.job_title.trim() || "Untitled role";
  const summaryLine = [entry.company, dateRange(entry)].filter(Boolean).join(" · ");
  // A role's own fields can be blank while confirmed duties still exist for it (see
  // useRoleDuties.ts - the duty lookup is keyed by job_title and never clears once loaded, even if
  // the job title field is edited afterwards), so emptiness has to account for both.
  const roleHasContent = !isRoleEntryEmpty(entry) || duties.items.some((item) => item.user_state === "confirmed");
  // No resume-extracted description means this role was added by hand via "+ Add role" - it gets
  // the two-column "Suggest tasks" layout (RoleContentList variant="manual") instead of the
  // extracted-role stacked layout with "Ideas from this role". See the plan doc for why these
  // don't coexist for the same role.
  //
  // Captured once on mount (lazy initializer), not recomputed every render: this switches which
  // JSX element sits at the same tree position (a two-column div vs. a stacked fragment), so a
  // live `const` here would remount the whole subtree - discarding OriginalTasksList's open/
  // editing state - the instant "+ Add notes about this role" put its first character into
  // entry.description. Whether a role was originally manual is a fact about how it was created,
  // not something that should flip mid-edit.
  const [isManual] = useState(() => !entry.description.trim());

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition-colors duration-fast ease-editorial hover:border-accent/40"
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${hasAchievements ? "bg-accent" : "border border-ink-muted"}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <RoleSummaryText title={title} summaryLine={summaryLine} />
        </span>
        <Chevron open={false} />
      </button>
    );
  }

  const detailsFields = (
    <>
      {detailsOpen ? (
        <>
          {/* sm: is a viewport breakpoint, not a container one - the manual layout's fields sit
              in a half-width column (see the two-column grid below), so reusing the extracted
              layout's viewport-based sm:grid-cols-2/3 here would still switch to multi-column on
              any wide-enough screen regardless of how little room this column actually has,
              squeezing Start/End date down to unreadable slivers. Manual roles stack instead;
              extracted roles keep the original full-width grid untouched. */}
          {isManual ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Job title" value={entry.job_title} onChange={(e) => onUpdate({ job_title: e.target.value })} />
                <Input label="Company" value={entry.company} onChange={(e) => onUpdate({ company: e.target.value })} />
              </div>
              <Input label="Location" value={entry.location} onChange={(e) => onUpdate({ location: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <MonthYearField label="Start date" value={entry.start_date} onChange={(value) => onUpdate({ start_date: value })} />
                <MonthYearField
                  label="End date"
                  value={entry.end_date}
                  disabled={entry.is_current}
                  onChange={(value) => onUpdate({ end_date: value })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Job title" value={entry.job_title} onChange={(e) => onUpdate({ job_title: e.target.value })} />
                <Input label="Company" value={entry.company} onChange={(e) => onUpdate({ company: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_1fr]">
                <Input label="Location" value={entry.location} onChange={(e) => onUpdate({ location: e.target.value })} />
                <MonthYearField label="Start date" value={entry.start_date} onChange={(value) => onUpdate({ start_date: value })} />
                <MonthYearField
                  label="End date"
                  value={entry.end_date}
                  disabled={entry.is_current}
                  onChange={(value) => onUpdate({ end_date: value })}
                />
              </div>
            </>
          )}
          <Checkbox
            id={`current-role-${entry._key}`}
            label="I currently work here"
            checked={entry.is_current}
            onChange={(e) => {
              const isCurrent = e.target.checked;
              onUpdate({ is_current: isCurrent, end_date: isCurrent ? "" : entry.end_date });
            }}
          />
          <button
            type="button"
            className="self-start rounded-sm text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setDetailsOpen(false)}
          >
            Done editing role details
          </button>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded border border-border bg-paper-deep/40 p-3">
          <div className="min-w-0">
            <RoleSummaryText title={title} summaryLine={summaryLine} />
          </div>
          <button
            type="button"
            className="shrink-0 rounded-sm text-xs font-medium text-accent underline transition-colors duration-fast ease-editorial hover:text-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setDetailsOpen(true)}
          >
            Edit role details
          </button>
        </div>
      )}

      {/* Rendered unconditionally (not just while detailsOpen) so a real validation error on any
          of these fields is never hidden behind the collapsed summary above - FieldMessages
          itself renders nothing when there's nothing to show. */}
      {messagesFor(`work_experience.${index}`)}
      {messagesFor(`work_experience.${index}.start_date`)}
      {messagesFor(`work_experience.${index}.end_date`)}
    </>
  );

  const achievementsSection = (
    <RoleContentList
      variant={isManual ? "manual" : "extracted"}
      wins={entry.wins}
      onWinsChange={(wins) => onUpdate({ wins })}
      duties={duties}
      jobTitle={entry.job_title}
      company={entry.company}
      location={entry.location}
      description={entry.description}
      onDescriptionChange={(description) => onUpdate({ description })}
      tools={tools}
      onAddTool={onAddTool}
      stakeholders={stakeholders}
      onAddStakeholder={onAddStakeholder}
    />
  );

  const removeButton = canRemove && (
    <button
      type="button"
      className="self-start rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onRemove(roleHasContent)}
    >
      Remove role
    </button>
  );

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex items-center justify-between gap-2 self-start rounded-sm text-sm font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Collapse
        <Chevron open={true} />
      </button>

      {isManual ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-5">
            {detailsFields}
            <OriginalTasksList
              description={entry.description}
              onDescriptionChange={(description) => onUpdate({ description })}
              findOpportunitiesAvailable={false}
              opportunitiesOpen={false}
              onToggleOpportunities={() => {}}
            />
            {removeButton}
          </div>
          {achievementsSection}
        </div>
      ) : (
        <>
          {detailsFields}
          <div className="h-px bg-border" />
          {achievementsSection}
          {removeButton}
        </>
      )}
    </div>
  );
}
