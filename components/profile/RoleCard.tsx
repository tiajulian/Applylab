"use client";

import { ReactNode, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { MonthYearField } from "@/components/profile/MonthYearField";
import { RoleContentList } from "@/components/profile/RoleContentList";
import { isThinExperience } from "@/lib/profile/thinExperience";
import { useRoleDuties } from "@/lib/profile/useRoleDuties";
import type { WorkExperienceRow } from "@/lib/profile/useProfileFieldsState";

function dateRange(entry: WorkExperienceRow): string {
  const end = entry.is_current ? "Present" : entry.end_date;
  const parts = [entry.start_date, end].filter(Boolean);
  return parts.join(" - ");
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
  onRemove: () => void;
  canRemove: boolean;
  tools: string[];
  onAddTool: (tool: string) => void;
  stakeholders: string[];
  onAddStakeholder: (stakeholder: string) => void;
  messagesFor: (field: string) => ReactNode;
}) {
  const [notesOpen, setNotesOpen] = useState(Boolean(entry.description.trim()));
  // Instantiated for every role regardless of expand state, matching the pre-redesign behaviour
  // where RoleDutiesReview's own zero-cost "already saved?" lookup ran for every role on page
  // load, not only the one open at the time.
  const duties = useRoleDuties({ jobTitle: entry.job_title, isThin: isThinExperience(entry) });
  const hasWins = entry.wins.length > 0;
  const title = entry.job_title.trim() || "Untitled role";
  const summaryLine = [entry.company, dateRange(entry)].filter(Boolean).join(" · ");

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition-colors duration-fast ease-editorial hover:border-accent/40"
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${hasWins ? "bg-accent" : "border border-ink-muted"}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{title}</span>
          {summaryLine && <span className="block truncate text-xs text-ink-secondary">{summaryLine}</span>}
        </span>
        <Chevron open={false} />
      </button>
    );
  }

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Job title" value={entry.job_title} onChange={(e) => onUpdate({ job_title: e.target.value })} />
        <Input label="Company" value={entry.company} onChange={(e) => onUpdate({ company: e.target.value })} />
      </div>
      {messagesFor(`work_experience.${index}`)}
      <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_1fr]">
        <Input label="Location" value={entry.location} onChange={(e) => onUpdate({ location: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <MonthYearField label="Start date" value={entry.start_date} onChange={(value) => onUpdate({ start_date: value })} />
          {messagesFor(`work_experience.${index}.start_date`)}
        </div>
        <div className="flex flex-col gap-1.5">
          <MonthYearField
            label="End date"
            value={entry.end_date}
            disabled={entry.is_current}
            onChange={(value) => onUpdate({ end_date: value })}
          />
          {messagesFor(`work_experience.${index}.end_date`)}
        </div>
      </div>
      <Checkbox
        id={`current-role-${entry._key}`}
        label="I currently work here"
        checked={entry.is_current}
        onChange={(e) => {
          const isCurrent = e.target.checked;
          onUpdate({ is_current: isCurrent, end_date: isCurrent ? "" : entry.end_date });
        }}
      />

      <div className="h-px bg-border" />

      <RoleContentList
        wins={entry.wins}
        onWinsChange={(wins) => onUpdate({ wins })}
        duties={duties}
        jobTitle={entry.job_title}
        company={entry.company}
        location={entry.location}
        description={entry.description}
        tools={tools}
        onAddTool={onAddTool}
        stakeholders={stakeholders}
        onAddStakeholder={onAddStakeholder}
      />

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className="flex items-center gap-1.5 self-start text-xs font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setNotesOpen((open) => !open)}
        >
          <Chevron open={notesOpen} />
          Notes (anything else)
        </button>
        {notesOpen && (
          <Textarea
            aria-label="Notes (anything else)"
            rows={3}
            placeholder="Anything else about this role that doesn't fit above"
            value={entry.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
          />
        )}
      </div>

      {canRemove && (
        <button
          type="button"
          className="self-start rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onRemove}
        >
          Remove role
        </button>
      )}
    </div>
  );
}
