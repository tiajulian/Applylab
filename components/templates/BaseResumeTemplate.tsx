"use client";
// See components/templates/shared.tsx's identical note: this file's stable-id hooks (useRef) are
// otherwise unreachable server-side breakage, since this module is also imported by the
// server-only DOCX export route (app/api/generate-docx/route.ts -> lib/export/resumeDocx.ts ->
// templateRegistry.ts). Safe at runtime too - those hooks only matter when editable is true, which
// the export path never sets.

/**
 * RULE ZERO: THE RESUME IS NOT AN ORGANIC SURFACE.
 *
 * Organic governs the app chrome around the resume — modals, buttons, tabs, cards.
 * The resume itself is a printable A4 document read by automated ATS parsers and hiring managers.
 * It strictly uses system fonts, black text (with single curated accent in Modern), and white background.
 * NEVER apply Caprasimo, cream ground, terracotta accents, rounded corners (--radius-*), or any
 * Organic design token to a resume page.
 */

import { Fragment, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import type { ProjectEntry, ResumeContent } from "@/types";
import { factCheckTargetKey } from "@/types";
import {
  DEFAULT_DENSITY,
  lineHeightFor,
  SUMMARY_LINE_HEIGHT,
  type TemplateDensity,
} from "@/lib/resume/templateDensity";
import type { TemplateTokens } from "@/lib/resume/templateMetadata";
import { EM_DASH, emDashifyRange, formatDateRange, formatIsoDateRange } from "@/lib/resume/formatDateRange";
import { effectiveSectionOrder, moveItem, RESUME_SECTION_LABELS, type ReorderableResumeSection } from "@/lib/resume/resumeSections";
import * as Updaters from "@/lib/resume/resumeFieldUpdaters";
import { TrashIcon } from "@/components/ui/icons/LucideIcons";
import {
  BulletList,
  closestCenter,
  DndContext,
  DraggableBlock,
  EditableField,
  HighlightSpan,
  rectSortingStrategy,
  RoleHeaderLine,
  SectionHeading,
  SectionToolbar,
  SortableContext,
  ToolRow,
  useBlockActive,
  useDndSensors,
  verticalListSortingStrategy,
  type DragEndEvent,
} from "@/components/templates/shared";
// One narrow, deliberate exception to the templates-don't-depend-on-resume-domain-components
// convention: the canvas's per-bullet AI-assist trigger genuinely needs resumeId and the
// /api/resume/[id]/assist endpoint, which can't live in this generic rendering-primitives layer.
import { BulletImproveMenu } from "@/components/resume/canvas/BulletImproveMenu";
import { ImportProjectsModal, projectEntryFromProfile } from "@/components/resume/canvas/ImportProjectsModal";

/** Stable ids for a flat list of canvas blocks (roles, projects), cached in a ref and only
 * regenerated for positions where the count actually changed - not on every keystroke, since a
 * transient text edit produces a new array reference but the same length. dnd-kit needs these ids
 * to stay stable across a drag gesture and while a field inside a block has focus, or it (and
 * React) lose track of which DOM node is which. See lib/hooks/useResumeHistory.ts's sibling
 * concern in the old accordion (ResumeEditorForm.tsx's bulletIds) for the same trade-off: a
 * mismatch after a non-adjacent insert/remove is a harmless one-off remount, not a data bug. */
function useStableIds(count: number): string[] {
  const ref = useRef<string[]>([]);
  if (ref.current.length !== count) {
    ref.current = Array.from({ length: count }, (_, i) => ref.current[i] ?? crypto.randomUUID());
  }
  return ref.current;
}

/** Same as useStableIds, for a list-of-lists (bullets nested under each role/project). */
function useStableNestedIds(counts: number[]): string[][] {
  const ref = useRef<string[][]>([]);
  const stale =
    ref.current.length !== counts.length || counts.some((c, i) => (ref.current[i]?.length ?? -1) !== c);
  if (stale) {
    ref.current = counts.map((c, i) => {
      const existing = ref.current[i] ?? [];
      return Array.from({ length: c }, (_, j) => existing[j] ?? crypto.randomUUID());
    });
  }
  return ref.current;
}

const hoverRowButtonStyle: CSSProperties = {
  cursor: "pointer",
  color: "#fff",
  backgroundColor: "#1f2937",
  borderRadius: "4px",
  width: "18px",
  height: "18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/** Lighter-weight sibling of DraggableBlock for rows that only need a remove affordance, no drag
 * (positioning-line chips - skills/tools/education/referees moved onto DraggableBlock's floating
 * toolbar, see the entry-toolbar work in BaseResumeTemplate.tsx's skills/tools/education/referees
 * sections). Same hover/focus-reveal behaviour, but the button is absolutely positioned over the
 * row's own corner instead of a portaled floating toolbar, since there's no drag handle competing
 * for space and no need to escape the sheet's transform/clip for a single static icon. */
function HoverRemoveRow({
  as = "div",
  style,
  removeLabel,
  onRemove,
  children,
}: {
  as?: "div" | "p";
  style?: CSSProperties;
  removeLabel: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { isActive, ref, handlers } = useBlockActive();
  const Tag = as as "div";
  return (
    <Tag ref={ref as Ref<HTMLDivElement>} style={{ ...style, position: "relative" }} {...handlers}>
      {children}
      {isActive && (
        <span className="print:hidden" style={{ position: "absolute", top: "2px", right: "2px", display: "flex" }}>
          <button type="button" aria-label={removeLabel} onClick={onRemove} style={hoverRowButtonStyle}>
            <TrashIcon style={{ width: "12px", height: "12px" }} strokeWidth={2} />
          </button>
        </span>
      )}
    </Tag>
  );
}

/** Zone for the sections with no heading (positioning line, referees): selectable like any section,
 * and shows the same SECTION-level toolbar (add) while selected. */
function SectionZone({
  label,
  addLabel,
  onAdd,
  editable = true,
  selected,
  onDelete,
  children,
  ...zoneProps
}: {
  label: string;
  addLabel: string;
  onAdd: () => void;
  onDelete?: () => void;
  editable?: boolean;
  /** Whether this zone is the current selection; the toolbar shows only then. */
  selected?: boolean;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <div {...zoneProps} style={{ ...(zoneProps.style as CSSProperties), position: "relative" }}>
      {children}
      {editable && selected && <SectionToolbar label={label} addLabel={addLabel} onAdd={onAdd} onDelete={onDelete} />}
    </div>
  );
}

/** Trailing "+ Add ..." text button, matching the accordion's existing convention, shown only in
 * editable mode at the end of a section/list. */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="print:hidden"
      style={{ fontSize: "0.85em", color: "var(--color-accent, #ca5933)", cursor: "pointer", background: "none", border: 0, padding: 0 }}
    >
      {label}
    </button>
  );
}

function px(basePx: number, scale: number, densityModifier: number = 1): string {
  return `${Math.round(basePx * scale * densityModifier * 10) / 10}px`;
}

export function buildTemplateStyles(
  tokens: TemplateTokens,
  density: TemplateDensity,
  customAccentColor?: string | null
): Record<string, CSSProperties> {
  const { fontPt, spacingScale } = density;
  const densityMod = tokens.density === "dense" ? 0.85 : tokens.density === "airy" ? 1.15 : 1.0;
  const accent = customAccentColor ?? tokens.accentColor;

  const sectionTitleStyle: CSSProperties = {
    fontSize: `${fontPt + 1}pt`,
    fontWeight: tokens.nameStyle.fontWeight >= 800 ? 800 : 700,
    fontFamily: tokens.headingFontFamily ?? tokens.fontFamily,
    color: "#1a1a1a",
    margin: `${px(11, spacingScale, densityMod)} 0 ${px(6, spacingScale, densityMod)}`,
    paddingBottom: "2px",
    breakInside: "avoid",
    pageBreakInside: "avoid",
    pageBreakAfter: "avoid",
  };

  if (tokens.headingStyle === "caps_rule") {
    // 1. Clean: Sans throughout, uppercase, full-width solid rule
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.08em";
    sectionTitleStyle.borderBottom = "1px solid #1a1a1a";
  } else if (tokens.headingStyle === "smallcaps_rule") {
    // 2. Classic: Serif, uppercase, lighter hairline rule
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.06em";
    sectionTitleStyle.borderBottom = "1px solid #cbd5e1";
    sectionTitleStyle.fontSize = `${fontPt + 0.5}pt`;
  } else if (tokens.headingStyle === "accent_unruled") {
    // 3. Modern: Unruled section headings, separating with accent color
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.06em";
    sectionTitleStyle.borderBottom = "none";
    sectionTitleStyle.color = accent ?? "#1e3a8a";
    sectionTitleStyle.fontSize = `${fontPt + 1}pt`;
    sectionTitleStyle.fontWeight = 800;
  } else if (tokens.headingStyle === "compact_unruled") {
    // 4. Compact: Unruled, tight spacing
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.04em";
    sectionTitleStyle.borderBottom = "none";
    sectionTitleStyle.fontSize = `${fontPt + 0.5}pt`;
  } else if (tokens.headingStyle === "editorial_grey_unruled") {
    // 5. Editorial: Unruled, quiet wide-tracked grey labels
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.08em";
    sectionTitleStyle.borderBottom = "none";
    sectionTitleStyle.color = "#64748b";
    sectionTitleStyle.fontSize = `${fontPt - 0.5}pt`;
    sectionTitleStyle.fontWeight = 600;
  } else if (tokens.headingStyle === "mono_label") {
    // 6. Technical: Monospace section labels with mono rule
    sectionTitleStyle.fontSize = `${fontPt}pt`;
    sectionTitleStyle.letterSpacing = "0.06em";
    sectionTitleStyle.borderBottom = "1px solid #475569";
    sectionTitleStyle.color = "#1e293b";
    sectionTitleStyle.textTransform = "uppercase";
  } else if (tokens.headingStyle === "executive_grey_unruled") {
    // 7. Executive: Unruled, quiet wide-tracked grey labels
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.1em";
    sectionTitleStyle.borderBottom = "none";
    sectionTitleStyle.color = "#78716c";
    sectionTitleStyle.fontSize = `${fontPt}pt`;
    sectionTitleStyle.fontWeight = 600;
  } else if (tokens.headingStyle === "plain_sentence_case") {
    // 8. Minimal: Unruled, sentence case, body weight-plus
    sectionTitleStyle.textTransform = "none";
    sectionTitleStyle.letterSpacing = "0";
    sectionTitleStyle.borderBottom = "none";
    sectionTitleStyle.fontSize = `${fontPt + 1}pt`;
    sectionTitleStyle.fontWeight = 700;
  }

  const isCenterHeader = tokens.headerAlignment === "center";
  const hasHeaderRule = tokens.headerRule;

  return {
    page: {
      fontFamily: tokens.fontFamily,
      color: "#1a1a1a",
      fontSize: `${fontPt}pt`,
      lineHeight: lineHeightFor(spacingScale),
    },
    header: {
      textAlign: isCenterHeader ? "center" : "left",
      marginBottom: px(14, spacingScale, densityMod),
      borderBottom: hasHeaderRule
        ? tokens.headingStyle === "accent_unruled"
          ? `2px solid ${accent ?? "#1e3a8a"}`
          : "1px solid #cbd5e1"
        : "none",
      paddingBottom: hasHeaderRule ? px(8, spacingScale, densityMod) : undefined,
    },
    name: {
      fontSize: `${fontPt + tokens.nameStyle.fontPtDelta}pt`,
      fontWeight: tokens.nameStyle.fontWeight,
      fontFamily: tokens.nameStyle.fontFamily ?? tokens.fontFamily,
      textTransform: tokens.nameStyle.casing === "uppercase" ? "uppercase" : "none",
      color: tokens.headingStyle === "accent_unruled" ? (accent ?? "#1e3a8a") : "#0f172a",
      margin: 0,
      letterSpacing: tokens.nameStyle.letterSpacing ?? "0.02em",
    },
    positioning: {
      fontSize: `${fontPt}pt`,
      fontStyle: "italic",
      color: tokens.headingStyle === "accent_unruled" ? (accent ?? "#1e3a8a") : "#334155",
      fontWeight: tokens.headingStyle === "accent_unruled" ? 600 : 400,
      margin: `${px(3, spacingScale, densityMod)} 0 0`,
    },
    contactLine: {
      fontSize: `${fontPt - 0.5}pt`,
      color: "#475569",
      margin: `${px(4, spacingScale, densityMod)} 0 0`,
    },
    sectionTitle: sectionTitleStyle,
    roleBlock: {
      marginBottom: px(6, spacingScale, densityMod),
      breakInside: "avoid",
      pageBreakInside: "avoid",
    },
    roleHeaderLine: {
      display: "flex",
      justifyContent: "space-between",
      gap: "8px",
    },
    roleHeaderLeft: { flex: 1 },
    roleTitle: {
      fontFamily: tokens.roleTitleFontFamily ?? tokens.fontFamily,
      fontWeight: 700,
    },
    sublineLocation: {
      fontSize: `${fontPt - 0.5}pt`,
      fontStyle: "italic",
      color: "#475569",
      margin: "1px 0 0",
    },
    dates: {
      whiteSpace: "nowrap",
      color: "#1a1a1a",
      fontFamily: tokens.dateFormat === "iso_mono" ? (tokens.headingFontFamily ?? "monospace") : undefined,
      fontSize: tokens.dateFormat === "iso_mono" ? `${fontPt - 0.5}pt` : undefined,
    },
    bulletList: {
      listStyle: "none",
      margin: `${px(3, spacingScale, densityMod)} 0 0`,
      padding: 0,
    },
    bullet: {
      margin: `0 0 ${px(2, spacingScale, densityMod)}`,
      paddingLeft: "14px",
      textIndent: "-14px",
    },
    summary: {
      margin: 0,
      lineHeight: SUMMARY_LINE_HEIGHT,
    },
    skillsGrid: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
      columnGap: "16px",
      rowGap: px(2, spacingScale, densityMod),
      margin: 0,
    },
    skillItem: {
      fontSize: `${fontPt}pt`,
      minWidth: 0,
      wordBreak: "break-word",
    },
    toolRow: { margin: `${px(3, spacingScale, densityMod)} 0` },
    toolLabel: {
      color: tokens.headingStyle === "accent_unruled" ? (accent ?? "#1e3a8a") : "#1a1a1a",
      fontFamily: tokens.headingStyle === "mono_label" ? tokens.headingFontFamily : undefined,
    },
    eduBlock: {
      marginBottom: px(5, spacingScale, densityMod),
      breakInside: "avoid",
      pageBreakInside: "avoid",
    },
    eduNotes: {
      margin: `${px(2, spacingScale, densityMod)} 0 0`,
      fontSize: `${fontPt - 1}pt`,
      color: "#475569",
    },
    refereeLine: {
      marginTop: px(10, spacingScale, densityMod),
      fontSize: `${fontPt - 0.5}pt`,
      color: "#475569",
    },
  };
}

export function BaseResumeTemplate({
  resume,
  tokens,
  density = DEFAULT_DENSITY,
  accentColor,
  highlights = {},
  onHighlightActivate,
  activeSection,
  onSectionClick,
  editable,
  onFieldChange,
  onFieldCommit,
  onFieldBlur,
  resumeId,
  profileProjects = [],
}: {
  resume: ResumeContent;
  tokens: TemplateTokens;
  density?: TemplateDensity;
  accentColor?: string | null;
  highlights?: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
  activeSection?: string | null;
  onSectionClick?: (sectionId: string) => void;
  /** Phase 2 WYSIWYG canvas: renders every field below as an EditableField instead of static
   * text. Never set by the PDF/DOCX export path, so print fidelity is unaffected by construction. */
  editable?: boolean;
  /** Per-keystroke edits - transient, checkpointed later via onFieldBlur or an idle pause. */
  onFieldChange?: (next: ResumeContent) => void;
  /** Discrete/structural edits (add, remove, reorder) - each call is its own undo step. */
  onFieldCommit?: (next: ResumeContent) => void;
  onFieldBlur?: () => void;
  /** Only used (when editable) to power each bullet's AI-assist trigger via
   * /api/resume/[id]/assist - omit it and bullets simply render without that trigger. */
  resumeId?: string;
  /** Only used (when editable) to offer "+ Import from profile" on the Projects section. */
  profileProjects?: ProjectEntry[];
}) {
  const styles = buildTemplateStyles(tokens, density, accentColor);
  const isClassic = tokens.headerAlignment === "center" && tokens.locationStyle === "subline_italic";
  const isIsoDates = tokens.dateFormat === "iso_mono";
  const change = onFieldChange ?? (() => {});
  const commit = onFieldCommit ?? (() => {});
  const dndSensors = useDndSensors();
  const [showImportProjects, setShowImportProjects] = useState(false);

  // Stable dnd-kit/React identity for draggable blocks - always computed (hooks can't be
  // conditional), cheap when not editable since nothing reads them in that branch.
  const experienceIds = useStableIds(resume.experience.length);
  const experienceBulletIds = useStableNestedIds(resume.experience.map((e) => e.bullets.length));
  const projectIds = useStableIds(resume.projects.length);
  const projectBulletIds = useStableNestedIds(resume.projects.map((p) => p.bullets.length));
  const skillIds = useStableIds(resume.skills.length);
  const toolIds = useStableIds((resume.tools ?? []).length);
  const educationIds = useStableIds(resume.education.length);
  const refereeIds = useStableIds(resume.referees.length);

  // Render order of the reorderable sections: the user's chosen order (Phase 1 "reorder sections"
  // toolbar control), else the template's own default (Technical promotes Skills & Tools above
  // Experience) for every resume created before that control existed.
  const sectionOrder = effectiveSectionOrder(resume.section_order, tokens.sectionOrder === "skills_first");

  // What "delete section" empties - the section itself stays (it's part of the template), so this
  // clears its content; the editor's undo brings it back.
  const clearedSection: Record<ReorderableResumeSection, Partial<ResumeContent>> = {
    summary: { summary: "" },
    experience: { experience: [] },
    skills: { skills: [] },
    tools: { tools: [] },
    projects: { projects: [] },
    education: { education: [] },
  };
  const sectionToolbar = (id: ReorderableResumeSection, addLabel?: string, onAdd?: () => void) => {
    if (!editable || !selectedFor(id)) return null;
    const index = sectionOrder.indexOf(id);
    const move = (direction: -1 | 1) => () => commit({ ...resume, section_order: moveItem(sectionOrder, index, direction) });
    return (
      <SectionToolbar
        label={`Section: ${RESUME_SECTION_LABELS[id]}`}
        addLabel={addLabel}
        onAdd={onAdd}
        onMoveUp={index > 0 ? move(-1) : undefined}
        onMoveDown={index < sectionOrder.length - 1 ? move(1) : undefined}
        onDelete={() => commit({ ...resume, ...clearedSection[id] })}
        deleteLabel={`Delete ${RESUME_SECTION_LABELS[id]} content`}
      />
    );
  };

  /** Whether this zone is the selection - undefined (not false) when selection isn't wired up at
   * all, so toolbars fall back to hover-reveal (the export/read-only paths and legacy callers). */
  const selectedFor = (id: string) => (onSectionClick ? activeSection === id : undefined);

  // A selectable zone at either level: a whole section ("experience") or one item inside it
  // ("experience:2"). Items stop propagation so selecting one doesn't also select its section.
  function getZoneProps(zoneId: string, label: string, kind: "section" | "item" = "section") {
    if (!onSectionClick) return {};
    const sectionId = zoneId;
    const isActive = activeSection === sectionId;
    return {
      "data-section": sectionId,
      role: "button" as const,
      tabIndex: 0,
      "aria-label": `Edit ${label} ${kind}`,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onSectionClick(sectionId);
      },
      // Tabbing into a field selects its zone too, so keyboard users get the selection toolbar.
      // Innermost zone wins (stopPropagation), same as click.
      onFocus: (e: React.FocusEvent) => {
        e.stopPropagation();
        if (activeSection !== sectionId) onSectionClick(sectionId);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        // Only the zone itself - Enter/Space typed into a field inside it must reach that field.
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
          onSectionClick(sectionId);
        }
      },
      style: {
        position: "relative" as const,
        // Items keep their own look (skill chips, referee rows...) - only sections get the shared
        // pointer cursor and rounding.
        ...(kind === "section" ? { cursor: "pointer", borderRadius: "4px" } : null),
        transition: "background-color 0.15s ease, box-shadow 0.15s ease",
        // Only set when active, so an item's own background (e.g. a flagged referee's tint) survives.
        // The huge spread shadow dims everything outside the selected zone (a shadow never paints
        // inside its own box, and z-index lifts the zone above its siblings) - the "spotlight".
        // Editor-only: the export path passes no onSectionClick, so this never reaches a PDF.
        ...(isActive
          ? {
              zIndex: 1,
              boxShadow: "0 0 0 2px var(--color-accent, #ca5933), 0 0 0 9999px rgba(15, 23, 42, 0.32)",
            }
          : null),
      },
    };
  }

  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
  ].filter(Boolean);

  const headingPrefix = tokens.headingStyle === "mono_label" ? "// " : "";

  const summaryTitle = tokens.sectionTitles?.summary ?? "Professional Summary";
  const experienceTitle = tokens.sectionTitles?.experience ?? "Professional Experience";
  const skillsTitle = tokens.sectionTitles?.skills ?? "Skills & Core Competencies";
  const toolsTitle = tokens.sectionTitles?.tools ?? "Tools & Technologies";
  const projectsTitle = tokens.sectionTitles?.projects ?? "Key Projects";
  const educationTitle = tokens.sectionTitles?.education ?? "Education";

  // Section 1: Summary Block
  const summarySection = (
    <div key="summary" {...getZoneProps("summary", "Professional summary")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{summaryTitle}</h2>
      {sectionToolbar("summary")}
      <p style={styles.summary}>
        <HighlightSpan
          targetKey="summary"
          highlight={highlights.summary}
          onActivate={onHighlightActivate}
          editable={editable}
          editableAs="textarea"
          value={resume.summary}
          onChange={(value) => change(Updaters.updateSummary(resume, value))}
          onBlur={onFieldBlur}
          ariaLabel="Professional summary"
        >
          {resume.summary}
        </HighlightSpan>
      </p>
    </div>
  );

  // Section 2: Experience Block
  function handleExperienceDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = experienceIds.indexOf(String(active.id));
    const to = experienceIds.indexOf(String(over.id));
    if (from !== -1 && to !== -1) commit(Updaters.reorderExperience(resume, from, to));
  }

  const experienceEntries = resume.experience.map((job, i) => {
        const roleKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "role" });
        const jobTitleKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "job_title" });
        const companyKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "company" });
        const datesKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "dates" });

        const dateFormatted = isIsoDates
          ? formatIsoDateRange(job.start_date, job.end_date)
          : formatDateRange(job.start_date, job.end_date);

        const locationField = (
          <EditableField
            value={job.location}
            onChange={(value) => change(Updaters.updateExperience(resume, i, { location: value }))}
            onBlur={onFieldBlur}
            ariaLabel="Location"
            placeholder="Location"
            inputStyle={{ width: "auto", display: "inline-block" }}
          />
        );

        const content = (
          <>
            <RoleHeaderLine
              style={styles}
              dates={
                editable ? (
                  <span style={styles.dates}>
                    <EditableField
                      value={job.start_date}
                      onChange={(value) => change(Updaters.updateExperience(resume, i, { start_date: value }))}
                      onBlur={onFieldBlur}
                      ariaLabel="Start date"
                      targetKey={datesKey}
                      placeholder="Start"
                      inputStyle={{ width: "auto", minWidth: "2.5em", display: "inline-block" }}
                    />
                    {" - "}
                    <EditableField
                      value={job.end_date}
                      onChange={(value) => change(Updaters.updateExperience(resume, i, { end_date: value }))}
                      onBlur={onFieldBlur}
                      ariaLabel="End date"
                      targetKey={datesKey}
                      placeholder="Present"
                      inputStyle={{ width: "auto", minWidth: "2.5em", display: "inline-block" }}
                    />
                  </span>
                ) : (
                  <HighlightSpan
                    targetKey={datesKey}
                    highlight={highlights[roleKey] ?? highlights[datesKey]}
                    onActivate={onHighlightActivate}
                  >
                    {dateFormatted}
                  </HighlightSpan>
                )
              }
              left={
                <>
                  <HighlightSpan
                    as="strong"
                    targetKey={jobTitleKey}
                    highlight={highlights[roleKey] ?? highlights[jobTitleKey]}
                    onActivate={onHighlightActivate}
                    editable={editable}
                    value={job.job_title}
                    onChange={(value) => change(Updaters.updateExperience(resume, i, { job_title: value }))}
                    onBlur={onFieldBlur}
                    inputStyle={{ ...styles.roleTitle, width: "auto", display: "inline-block" }}
                    ariaLabel="Job title"
                  >
                    <span style={styles.roleTitle}>{job.job_title}</span>
                  </HighlightSpan>
                  {" · "}
                  <HighlightSpan
                    as="i"
                    targetKey={companyKey}
                    highlight={highlights[roleKey] ?? highlights[companyKey]}
                    onActivate={onHighlightActivate}
                    editable={editable}
                    value={job.company}
                    onChange={(value) => change(Updaters.updateExperience(resume, i, { company: value }))}
                    onBlur={onFieldBlur}
                    inputStyle={{ fontStyle: "italic", width: "auto", display: "inline-block" }}
                    ariaLabel="Company"
                  >
                    {job.company}
                  </HighlightSpan>
                  {!isClassic &&
                    (editable ? (
                      <>
                        {" "}
                        {EM_DASH} {locationField}
                      </>
                    ) : job.location ? (
                      ` ${EM_DASH} ${job.location}`
                    ) : (
                      ""
                    ))}
                </>
              }
            />
            {isClassic &&
              (editable ? (
                <p style={styles.sublineLocation}>{locationField}</p>
              ) : (
                job.location && <p style={styles.sublineLocation}>{job.location}</p>
              ))}
            {(job.bullets.length > 0 || editable) && (
              <BulletList
                bullets={job.bullets}
                bulletIds={experienceBulletIds[i]}
                style={styles}
                targetKind="experienceBullet"
                entryIndex={i}
                highlights={highlights}
                onHighlightActivate={onHighlightActivate}
                editable={editable}
                onBulletChange={(bulletIndex, value) =>
                  change(Updaters.updateExperienceBullet(resume, i, bulletIndex, value))
                }
                onBulletBlur={onFieldBlur}
                onBulletRemove={(bulletIndex) => commit(Updaters.removeExperienceBullet(resume, i, bulletIndex))}
                onBulletReorder={(from, to) => commit(Updaters.reorderExperienceBullet(resume, i, from, to))}
                onBulletAdd={() => commit(Updaters.addExperienceBullet(resume, i))}
                renderBulletExtra={
                  resumeId
                    ? (bulletIndex) => (
                        <BulletImproveMenu
                          resumeId={resumeId}
                          bulletText={job.bullets[bulletIndex]}
                          roleTitle={job.job_title}
                          roleCompany={job.company}
                          onAccept={(value) => commit(Updaters.updateExperienceBullet(resume, i, bulletIndex, value))}
                        />
                      )
                    : undefined
                }
              />
            )}
          </>
        );

        if (!editable) {
          return (
            <div key={i} style={styles.roleBlock}>
              {content}
            </div>
          );
        }

        return (
          <DraggableBlock
            key={experienceIds[i]}
            id={experienceIds[i]}
            zone={getZoneProps(`experience:${i}`, "role", "item")}
            selected={selectedFor(`experience:${i}`)}
            levelLabel="Role"
            as="div"
            style={styles.roleBlock}
            removeLabel="Remove role"
            onRemove={() => commit(Updaters.removeExperience(resume, i))}
            variant="entry"
            onAddEntry={() => commit(Updaters.addExperienceBullet(resume, i))}
            addEntryLabel="Add bullet"
            onMoveUp={i > 0 ? () => commit(Updaters.reorderExperience(resume, i, i - 1)) : undefined}
            onMoveDown={i < resume.experience.length - 1 ? () => commit(Updaters.reorderExperience(resume, i, i + 1)) : undefined}
          >
            {content}
          </DraggableBlock>
        );
      });

  const experienceSection = (
    <div key="experience" {...getZoneProps("experience", "Work experience")}>
      <SectionHeading title={`${headingPrefix}${experienceTitle}`} style={styles.sectionTitle} />
      {sectionToolbar("experience", "Add role", () => commit(Updaters.addExperience(resume)))}
      {editable ? (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleExperienceDragEnd}>
          <SortableContext items={experienceIds} strategy={verticalListSortingStrategy}>
            {experienceEntries}
          </SortableContext>
        </DndContext>
      ) : (
        experienceEntries
      )}
    </div>
  );

  // Section 3: Skills Block
  function handleSkillDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = skillIds.indexOf(String(active.id));
    const to = skillIds.indexOf(String(over.id));
    if (from !== -1 && to !== -1) commit(Updaters.reorderSkill(resume, from, to));
  }

  const skillItems = resume.skills.map((skill, i) =>
    editable ? (
      <DraggableBlock
        key={skillIds[i]}
        id={skillIds[i]}
        zone={getZoneProps(`skills:${i}`, "skill", "item")}
        selected={selectedFor(`skills:${i}`)}
        levelLabel="Skill"
        as="div"
        style={{
          ...styles.skillItem,
          display: "flex",
          alignItems: "flex-start",
          gap: "4px",
          minWidth: 0,
        }}
        removeLabel="Remove skill"
        onRemove={() => commit(Updaters.setSkills(resume, resume.skills.filter((_, si) => si !== i)))}
        variant="bullet"
        onAddEntry={() => commit(Updaters.setSkills(resume, [...resume.skills, ""]))}
        addEntryLabel="Add skill"
        onMoveUp={i > 0 ? () => commit(Updaters.moveSkill(resume, i, -1)) : undefined}
        onMoveDown={i < resume.skills.length - 1 ? () => commit(Updaters.moveSkill(resume, i, 1)) : undefined}
      >
        <span aria-hidden="true" style={{ flexShrink: 0, lineHeight: "inherit" }}>
          •{" "}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditableField
            as="textarea"
            value={skill}
            onChange={(value) => change(Updaters.setSkills(resume, resume.skills.map((s, si) => (si === i ? value : s))))}
            onBlur={onFieldBlur}
            ariaLabel="Skill"
            targetKey={factCheckTargetKey({ kind: "skill", index: i })}
            inputStyle={{
              width: "100%",
              wordBreak: "break-word",
              lineHeight: "inherit",
              resize: "none",
              overflow: "hidden",
            }}
          />
        </div>
      </DraggableBlock>
    ) : (
      <p key={i} style={{ ...styles.skillItem, wordBreak: "break-word" }}>
        • {skill}
      </p>
    )
  );

  const skillsSection = resume.skills.length > 0 || editable ? (
    <div key="skills" {...getZoneProps("skills", "Key skills")}>
      <SectionHeading title={`${headingPrefix}${skillsTitle}`} style={styles.sectionTitle} />
      {sectionToolbar("skills", "Add skill", () => commit(Updaters.setSkills(resume, [...resume.skills, ""])))}
      {editable ? (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSkillDragEnd}>
          <SortableContext items={skillIds} strategy={rectSortingStrategy}>
            <div style={styles.skillsGrid}>{skillItems}</div>
          </SortableContext>
        </DndContext>
      ) : (
        <div style={styles.skillsGrid}>{skillItems}</div>
      )}
    </div>
  ) : null;

  // Section 4: Tools Block
  function handleToolDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = toolIds.indexOf(String(active.id));
    const to = toolIds.indexOf(String(over.id));
    if (from !== -1 && to !== -1) commit(Updaters.reorderTool(resume, from, to));
  }

  const toolItems = (resume.tools ?? []).map((tool, i) => {
    const row = (
      <ToolRow
        tool={tool}
        index={i}
        style={styles.toolRow}
        labelStyle={styles.toolLabel}
        highlights={highlights}
        onHighlightActivate={onHighlightActivate}
        editable={editable}
        onChange={(value) => change(Updaters.setTools(resume, resume.tools.map((t, ti) => (ti === i ? value : t))))}
        onBlur={onFieldBlur}
      />
    );
    if (!editable) return <div key={i}>{row}</div>;
    return (
      <DraggableBlock
        key={toolIds[i]}
        id={toolIds[i]}
        zone={getZoneProps(`tools:${i}`, "tool category", "item")}
        selected={selectedFor(`tools:${i}`)}
        levelLabel="Tool"
        removeLabel="Remove tool"
        onRemove={() => commit(Updaters.setTools(resume, resume.tools.filter((_, ti) => ti !== i)))}
        variant="bullet"
        onAddEntry={() => commit(Updaters.setTools(resume, [...(resume.tools ?? []), ""]))}
        addEntryLabel="Add tool category"
        onMoveUp={i > 0 ? () => commit(Updaters.moveTool(resume, i, -1)) : undefined}
        onMoveDown={i < (resume.tools ?? []).length - 1 ? () => commit(Updaters.moveTool(resume, i, 1)) : undefined}
      >
        {row}
      </DraggableBlock>
    );
  });

  const toolsSection = (resume.tools && resume.tools.length > 0) || editable ? (
    <div key="tools" {...getZoneProps("tools", "Tools and platforms")}>
      <SectionHeading title={`${headingPrefix}${toolsTitle}`} style={styles.sectionTitle} />
      {sectionToolbar("tools", "Add tool category", () => commit(Updaters.setTools(resume, [...(resume.tools ?? []), ""])))}
      {editable ? (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleToolDragEnd}>
          <SortableContext items={toolIds} strategy={verticalListSortingStrategy}>
            {toolItems}
          </SortableContext>
        </DndContext>
      ) : (
        toolItems
      )}
    </div>
  ) : null;

  // Section 5: Projects Block
  function handleProjectDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = projectIds.indexOf(String(active.id));
    const to = projectIds.indexOf(String(over.id));
    if (from !== -1 && to !== -1) commit(Updaters.reorderProject(resume, from, to));
  }

  const projectEntries = resume.projects.map((project, i) => {
        const projectKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "project" });
        const titleKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "title" });
        const yearKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "year" });
        const content = (
          <>
            <RoleHeaderLine
              style={styles}
              dates={
                editable ? (
                  <EditableField
                    value={project.year}
                    onChange={(value) => change(Updaters.updateProject(resume, i, { year: value }))}
                    onBlur={onFieldBlur}
                    ariaLabel="Year"
                    placeholder="Year"
                    inputStyle={{ width: "auto", minWidth: "2.5em", display: "inline-block" }}
                  />
                ) : project.year ? (
                  <HighlightSpan
                    targetKey={yearKey}
                    highlight={highlights[projectKey] ?? highlights[yearKey]}
                    onActivate={onHighlightActivate}
                  >
                    {emDashifyRange(project.year)}
                  </HighlightSpan>
                ) : null
              }
              left={
                <>
                  <HighlightSpan
                    as="strong"
                    targetKey={titleKey}
                    highlight={highlights[projectKey] ?? highlights[titleKey]}
                    onActivate={onHighlightActivate}
                    editable={editable}
                    value={project.title}
                    onChange={(value) => change(Updaters.updateProject(resume, i, { title: value }))}
                    onBlur={onFieldBlur}
                    inputStyle={{ ...styles.roleTitle, width: "auto", display: "inline-block" }}
                    ariaLabel="Project title"
                  >
                    <span style={styles.roleTitle}>{project.title}</span>
                  </HighlightSpan>
                  {(editable || project.context) && (
                    <>
                      {" · "}
                      {editable ? (
                        <EditableField
                          value={project.context}
                          onChange={(value) => change(Updaters.updateProject(resume, i, { context: value }))}
                          onBlur={onFieldBlur}
                          ariaLabel="Context or tools"
                          placeholder="Context / tools"
                          inputStyle={{ width: "auto", display: "inline-block", color: "#475569" }}
                        />
                      ) : (
                        <span style={{ color: "#475569" }}>{project.context}</span>
                      )}
                    </>
                  )}
                </>
              }
            />
            {(project.bullets.length > 0 || editable) && (
              <BulletList
                bullets={project.bullets}
                bulletIds={projectBulletIds[i]}
                style={styles}
                targetKind="projectBullet"
                entryIndex={i}
                highlights={highlights}
                onHighlightActivate={onHighlightActivate}
                editable={editable}
                onBulletChange={(bulletIndex, value) => change(Updaters.updateProjectBullet(resume, i, bulletIndex, value))}
                onBulletBlur={onFieldBlur}
                onBulletRemove={(bulletIndex) => commit(Updaters.removeProjectBullet(resume, i, bulletIndex))}
                onBulletReorder={(from, to) => commit(Updaters.reorderProjectBullet(resume, i, from, to))}
                onBulletAdd={() => commit(Updaters.addProjectBullet(resume, i))}
                renderBulletExtra={
                  resumeId
                    ? (bulletIndex) => (
                        <BulletImproveMenu
                          resumeId={resumeId}
                          bulletText={project.bullets[bulletIndex]}
                          roleTitle={project.title}
                          roleCompany={project.context}
                          onAccept={(value) => commit(Updaters.updateProjectBullet(resume, i, bulletIndex, value))}
                        />
                      )
                    : undefined
                }
              />
            )}
          </>
        );

        if (!editable) {
          return (
            <div key={i} style={styles.roleBlock}>
              {content}
            </div>
          );
        }

        return (
          <DraggableBlock
            key={projectIds[i]}
            id={projectIds[i]}
            zone={getZoneProps(`projects:${i}`, "project", "item")}
            selected={selectedFor(`projects:${i}`)}
            levelLabel="Project"
            as="div"
            style={styles.roleBlock}
            removeLabel="Remove project"
            onRemove={() => commit(Updaters.removeProject(resume, i))}
            variant="entry"
            onAddEntry={() => commit(Updaters.addProjectBullet(resume, i))}
            addEntryLabel="Add bullet"
            onMoveUp={i > 0 ? () => commit(Updaters.reorderProject(resume, i, i - 1)) : undefined}
            onMoveDown={i < resume.projects.length - 1 ? () => commit(Updaters.reorderProject(resume, i, i + 1)) : undefined}
          >
            {content}
          </DraggableBlock>
        );
      });

  const projectsSection = density.showProjects && (resume.projects.length > 0 || editable) ? (
    <div key="projects" {...getZoneProps("projects", "Projects")}>
      <SectionHeading title={`${headingPrefix}${projectsTitle}`} style={styles.sectionTitle} />
      {sectionToolbar("projects", "Add project", () => commit(Updaters.addProject(resume)))}
      {editable ? (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
          <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
            {projectEntries}
          </SortableContext>
        </DndContext>
      ) : (
        projectEntries
      )}
      {editable && profileProjects.length > 0 && (
        <>
          {" "}
          <AddButton label="+ Import from profile" onClick={() => setShowImportProjects(true)} />
        </>
      )}
      {showImportProjects && (
        <ImportProjectsModal
          profileProjects={profileProjects}
          resumeProjects={resume.projects}
          onImport={(proj) => commit(Updaters.addProject(resume, projectEntryFromProfile(proj)))}
          onClose={() => setShowImportProjects(false)}
        />
      )}
    </div>
  ) : null;

  // Section 6: Education Block
  function handleEducationDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = educationIds.indexOf(String(active.id));
    const to = educationIds.indexOf(String(over.id));
    if (from !== -1 && to !== -1) commit(Updaters.reorderEducation(resume, from, to));
  }

  const educationEntries = resume.education.map((edu, i) => {
        const degreeKey = factCheckTargetKey({ kind: "education", index: i, field: "degree" });
        const instKey = factCheckTargetKey({ kind: "education", index: i, field: "institution" });
        const content = (
          <>
            <RoleHeaderLine
              style={styles}
              dates={
                editable ? (
                  <EditableField
                    value={edu.year}
                    onChange={(value) => change(Updaters.updateEducation(resume, i, { year: value }))}
                    onBlur={onFieldBlur}
                    ariaLabel="Year"
                    placeholder="Year"
                    inputStyle={{ width: "auto", minWidth: "2.5em", display: "inline-block" }}
                  />
                ) : edu.year ? (
                  emDashifyRange(edu.year)
                ) : null
              }
              left={
                <>
                  <HighlightSpan
                    as="strong"
                    targetKey={degreeKey}
                    highlight={highlights[degreeKey]}
                    onActivate={onHighlightActivate}
                    editable={editable}
                    value={edu.degree}
                    onChange={(value) => change(Updaters.updateEducation(resume, i, { degree: value }))}
                    onBlur={onFieldBlur}
                    inputStyle={{ fontWeight: 700, width: "auto", display: "inline-block" }}
                    ariaLabel="Degree or qualification"
                  >
                    {edu.degree}
                  </HighlightSpan>
                  {" · "}
                  <HighlightSpan
                    as="i"
                    targetKey={instKey}
                    highlight={highlights[instKey]}
                    onActivate={onHighlightActivate}
                    editable={editable}
                    value={edu.institution}
                    onChange={(value) => change(Updaters.updateEducation(resume, i, { institution: value }))}
                    onBlur={onFieldBlur}
                    inputStyle={{ fontStyle: "italic", width: "auto", display: "inline-block" }}
                    ariaLabel="Institution"
                  >
                    {edu.institution}
                  </HighlightSpan>
                </>
              }
            />
            {editable ? (
              <p style={styles.eduNotes}>
                <EditableField
                  value={edu.notes}
                  onChange={(value) => change(Updaters.updateEducation(resume, i, { notes: value }))}
                  onBlur={onFieldBlur}
                  ariaLabel="Notes"
                  placeholder="Notes (optional)"
                  style={styles.eduNotes}
                />
              </p>
            ) : (
              edu.notes && <p style={styles.eduNotes}>{edu.notes}</p>
            )}
          </>
        );

        if (!editable) {
          return (
            <div key={i} style={styles.eduBlock}>
              {content}
            </div>
          );
        }

        return (
          <DraggableBlock
            key={educationIds[i]}
            id={educationIds[i]}
            zone={getZoneProps(`education:${i}`, "qualification", "item")}
            selected={selectedFor(`education:${i}`)}
            levelLabel="Qualification"
            style={styles.eduBlock}
            removeLabel="Remove qualification"
            onRemove={() => commit(Updaters.removeEducation(resume, i))}
            variant="entry"
            onAddEntry={() => commit(Updaters.addEducation(resume))}
            addEntryLabel="Add qualification"
            onMoveUp={i > 0 ? () => commit(Updaters.moveEducation(resume, i, -1)) : undefined}
            onMoveDown={i < resume.education.length - 1 ? () => commit(Updaters.moveEducation(resume, i, 1)) : undefined}
          >
            {content}
          </DraggableBlock>
        );
      });

  const educationSection = resume.education.length > 0 || editable ? (
    <div key="education" {...getZoneProps("education", "Education")}>
      <SectionHeading title={`${headingPrefix}${educationTitle}`} style={styles.sectionTitle} />
      {sectionToolbar("education", "Add qualification", () => commit(Updaters.addEducation(resume)))}
      {editable ? (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleEducationDragEnd}>
          <SortableContext items={educationIds} strategy={verticalListSortingStrategy}>
            {educationEntries}
          </SortableContext>
        </DndContext>
      ) : (
        educationEntries
      )}
    </div>
  ) : null;

  // Render sections in the user's chosen order (Phase 1 "reorder sections" toolbar control) when
  // set, falling back to the template's own prescribed default (Technical promotes Skills & Tools
  // above Experience) for every resume created before that control existed.
  const sectionNodes: Record<ReorderableResumeSection, ReactNode> = {
    summary: summarySection,
    experience: experienceSection,
    skills: skillsSection,
    tools: toolsSection,
    projects: projectsSection,
    education: educationSection,
  };

  return (
    <div style={styles.page}>
      {/* Header & Contact Zone */}
      <div style={styles.header} {...getZoneProps("contact", "Contact")}>
        {editable ? (
          <EditableField
            value={resume.contact.name}
            onChange={(value) => change(Updaters.updateContact(resume, "name", value))}
            onBlur={onFieldBlur}
            ariaLabel="Full name"
            placeholder="Full name"
            style={styles.name}
          />
        ) : (
          <h1 style={styles.name}>{resume.contact.name}</h1>
        )}

        {(resume.target_titles.length > 0 || editable) && (
          <SectionZone
            style={styles.positioning}
            label="Section: Positioning line"
            addLabel="Add title"
            onAdd={() => commit(Updaters.setTargetTitles(resume, [...resume.target_titles, ""]))}
            onDelete={resume.target_titles.length > 0 ? () => commit(Updaters.setTargetTitles(resume, [])) : undefined}
            editable={editable}
            selected={selectedFor("target_titles")}
            {...getZoneProps("target_titles", "Positioning line")}
          >
            {editable ? (
              <>
                {resume.target_titles.map((title, i) => (
                  <HoverRemoveRow
                    key={i}
                    style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}
                    removeLabel="Remove positioning title"
                    onRemove={() =>
                      commit(Updaters.setTargetTitles(resume, resume.target_titles.filter((_, ti) => ti !== i)))
                    }
                  >
                    {i > 0 && " · "}
                    <EditableField
                      value={title}
                      onChange={(value) =>
                        change(Updaters.setTargetTitles(resume, resume.target_titles.map((t, ti) => (ti === i ? value : t))))
                      }
                      onBlur={onFieldBlur}
                      ariaLabel="Positioning title"
                      inputStyle={{ width: "auto", display: "inline-block" }}
                    />
                  </HoverRemoveRow>
                ))}
                {/* Nothing to click on an empty line, so a screen-only placeholder stands in as the
                    selectable target - its section toolbar's "Add title" adds the first one. */}
                {resume.target_titles.length === 0 && (
                  <span className="print:hidden" style={{ opacity: 0.5, fontStyle: "italic" }}>
                    Positioning line
                  </span>
                )}
              </>
            ) : isClassic ? (
              resume.target_titles.join(" · ")
            ) : (
              resume.target_titles.map((title) => `· ${title}`).join(" ")
            )}
          </SectionZone>
        )}

        {editable ? (
          <p style={styles.contactLine}>
            <EditableField
              value={resume.contact.email}
              onChange={(value) => change(Updaters.updateContact(resume, "email", value))}
              onBlur={onFieldBlur}
              ariaLabel="Email"
              placeholder="Email"
              inputStyle={{ width: "auto", display: "inline-block" }}
            />
            {" | "}
            <EditableField
              value={resume.contact.phone}
              onChange={(value) => change(Updaters.updateContact(resume, "phone", value))}
              onBlur={onFieldBlur}
              ariaLabel="Phone"
              placeholder="Phone"
              inputStyle={{ width: "auto", display: "inline-block" }}
            />
            {" | "}
            <EditableField
              value={resume.contact.location}
              onChange={(value) => change(Updaters.updateContact(resume, "location", value))}
              onBlur={onFieldBlur}
              ariaLabel="Location"
              placeholder="Location"
              inputStyle={{ width: "auto", display: "inline-block" }}
            />
            {" | "}
            <EditableField
              value={resume.contact.work_rights}
              onChange={(value) => change(Updaters.updateContact(resume, "work_rights", value))}
              onBlur={onFieldBlur}
              ariaLabel="Work rights"
              placeholder="Work rights"
              inputStyle={{ width: "auto", display: "inline-block" }}
            />
            {" | "}
            <EditableField
              value={resume.contact.linkedin}
              onChange={(value) => change(Updaters.updateContact(resume, "linkedin", value))}
              onBlur={onFieldBlur}
              ariaLabel="LinkedIn"
              placeholder="LinkedIn"
              inputStyle={{ width: "auto", display: "inline-block" }}
            />
          </p>
        ) : (
          contactParts.length > 0 && (
            <p style={styles.contactLine}>
              {contactParts.join(" | ")}
              {resume.contact.linkedin ? ` | ${resume.contact.linkedin}` : ""}
            </p>
          )
        )}
      </div>

      {sectionOrder.map((sectionId) => (
        <Fragment key={sectionId}>{sectionNodes[sectionId]}</Fragment>
      ))}

      {density.showRefereeLine &&
        (editable ? (
          <SectionZone
            label="Section: Referees"
            addLabel="Add referee"
            onAdd={() => commit(Updaters.addReferee(resume))}
            onDelete={resume.referees.length > 0 ? () => commit({ ...resume, referees: [] }) : undefined}
            editable={editable}
            selected={selectedFor("referees")}
            {...getZoneProps("referees", "Referees")}
          >
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const from = refereeIds.indexOf(String(active.id));
                const to = refereeIds.indexOf(String(over.id));
                if (from !== -1 && to !== -1) commit(Updaters.reorderReferee(resume, from, to));
              }}
            >
              <SortableContext items={refereeIds} strategy={verticalListSortingStrategy}>
                {resume.referees.map((referee, i) => {
                  const key = factCheckTargetKey({ kind: "referee", index: i });
                  return (
                    <DraggableBlock
                      key={refereeIds[i]}
                      id={refereeIds[i]}
                      zone={getZoneProps(`referees:${i}`, "referee", "item")}
                      selected={selectedFor(`referees:${i}`)}
                      levelLabel="Referee"
                      style={{
                        ...styles.refereeLine,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "2px",
                      }}
                      removeLabel="Remove referee"
                      onRemove={() => commit(Updaters.removeReferee(resume, i))}
                      variant="bullet"
                      onAddEntry={() => commit(Updaters.addReferee(resume))}
                      addEntryLabel="Add referee"
                      onMoveUp={i > 0 ? () => commit(Updaters.moveReferee(resume, i, -1)) : undefined}
                      onMoveDown={i < resume.referees.length - 1 ? () => commit(Updaters.moveReferee(resume, i, 1)) : undefined}
                    >
                      {(
                        [
                          ["name", "Referee name"],
                          ["title", "Job title"],
                          ["organisation", "Organisation"],
                          ["phone", "Phone"],
                          ["email", "Email"],
                        ] as const
                      ).map(([field, label]) => (
                        <EditableField
                          key={field}
                          value={referee[field]}
                          onChange={(value) => change(Updaters.updateReferee(resume, i, { [field]: value }))}
                          onBlur={onFieldBlur}
                          ariaLabel={label}
                          placeholder={label}
                          inputStyle={{ width: "auto", minWidth: "4em", display: "inline-block" }}
                          // A referee has no sub-field target (see FactCheckTarget's "referee" kind), so
                          // only the first field carries the row's data-fc-target.
                          {...(field === "name" ? { targetKey: key } : {})}
                        />
                      ))}
                    </DraggableBlock>
                  );
                })}
              </SortableContext>
            </DndContext>
            {/* Same line the exported resume shows when there are no referees - also the selectable
                target whose section toolbar adds the first one. */}
            {resume.referees.length === 0 && <p style={styles.refereeLine}>Referees available upon request</p>}
          </SectionZone>
        ) : (
          <p style={styles.refereeLine} {...getZoneProps("referees", "Referees")}>
            {Array.isArray(resume.referees) && resume.referees.length > 0
              ? `Referees: ${resume.referees.map((r) => (typeof r === "string" ? r : (r as any).name ?? "")).filter(Boolean).join(", ")}`
              : typeof (resume.referees as unknown) === "string" && (resume.referees as unknown as string).trim()
              ? `Referees: ${resume.referees as unknown as string}`
              : "Referees available upon request"}
          </p>
        ))}
    </div>
  );
}





