/**
 * RULE ZERO: THE RESUME IS NOT AN ORGANIC SURFACE.
 *
 * Organic governs the app chrome around the resume — modals, buttons, tabs, cards.
 * The resume itself is a printable A4 document read by automated ATS parsers and hiring managers.
 * It strictly uses system fonts, black text (with single curated accent in Modern), and white background.
 * NEVER apply Caprasimo, cream ground, terracotta accents, rounded corners (--radius-*), or any
 * Organic design token to a resume page.
 */

import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { ResumeContent } from "@/types";
import { factCheckTargetKey } from "@/types";
import {
  DEFAULT_DENSITY,
  lineHeightFor,
  SUMMARY_LINE_HEIGHT,
  type TemplateDensity,
} from "@/lib/resume/templateDensity";
import type { TemplateTokens } from "@/lib/resume/templateMetadata";
import { EM_DASH, emDashifyRange, formatDateRange, formatIsoDateRange } from "@/lib/resume/formatDateRange";
import { DEFAULT_RESUME_SECTION_ORDER, type ReorderableResumeSection } from "@/lib/resume/resumeSections";
import * as Updaters from "@/lib/resume/resumeFieldUpdaters";
import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@/components/ui/icons/LucideIcons";
import { BulletList, EditableField, HighlightSpan, RoleHeaderLine, ToolRow } from "@/components/templates/shared";

/** Always-visible (not hover-gated - matches BulletEditor's existing touch-friendly pattern, see
 * Phase 2 plan) move-up/move-down/remove icon row for an editable entry block (a role, a project,
 * an education entry). `onMove` omitted entirely hides the move buttons - projects/education have
 * no entry-level reordering today, and this must not invent one. */
function EntryControls({
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel,
}: {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  const iconStyle: CSSProperties = { width: "0.85em", height: "0.85em" };
  return (
    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }} className="print:hidden">
      {onMoveUp && (
        <button type="button" aria-label="Move up" onClick={onMoveUp} style={{ cursor: "pointer" }}>
          <ArrowUpIcon style={iconStyle} strokeWidth={2.75} />
        </button>
      )}
      {onMoveDown && (
        <button type="button" aria-label="Move down" onClick={onMoveDown} style={{ cursor: "pointer" }}>
          <ArrowDownIcon style={iconStyle} strokeWidth={2.75} />
        </button>
      )}
      <button type="button" aria-label={removeLabel} onClick={onRemove} style={{ cursor: "pointer" }}>
        <TrashIcon style={iconStyle} strokeWidth={2.75} />
      </button>
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
      gridTemplateColumns: "1fr 1fr",
      columnGap: "16px",
      rowGap: px(2, spacingScale, densityMod),
      margin: 0,
    },
    skillItem: { fontSize: `${fontPt}pt` },
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
}) {
  const styles = buildTemplateStyles(tokens, density, accentColor);
  const isClassic = tokens.headerAlignment === "center" && tokens.locationStyle === "subline_italic";
  const isIsoDates = tokens.dateFormat === "iso_mono";
  const change = onFieldChange ?? (() => {});
  const commit = onFieldCommit ?? (() => {});

  function getZoneProps(sectionId: string, sectionLabel: string) {
    if (!onSectionClick) return {};
    const isActive = activeSection === sectionId;
    return {
      "data-section": sectionId,
      role: "button" as const,
      tabIndex: 0,
      "aria-label": `Edit ${sectionLabel} section`,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onSectionClick(sectionId);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSectionClick(sectionId);
        }
      },
      style: {
        cursor: "pointer",
        position: "relative" as const,
        borderRadius: "4px",
        transition: "background-color 0.15s ease, box-shadow 0.15s ease",
        backgroundColor: isActive ? "rgba(202, 89, 51, 0.08)" : undefined,
        boxShadow: isActive ? "0 0 0 2px var(--color-accent, #ca5933), 0 0 10px rgba(202, 89, 51, 0.2)" : undefined,
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
  const experienceSection = (
    <div key="experience" {...getZoneProps("experience", "Work experience")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{experienceTitle}</h2>
      {resume.experience.map((job, i) => {
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

        return (
          <div key={i} style={styles.roleBlock}>
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
                      placeholder="Start"
                      inputStyle={{ width: "auto", minWidth: "2.5em", display: "inline-block" }}
                    />
                    {" - "}
                    <EditableField
                      value={job.end_date}
                      onChange={(value) => change(Updaters.updateExperience(resume, i, { end_date: value }))}
                      onBlur={onFieldBlur}
                      ariaLabel="End date"
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
                    inputStyle={styles.roleTitle}
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
                    inputStyle={{ fontStyle: "italic" }}
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
                  {editable && (
                    <EntryControls
                      onMoveUp={i > 0 ? () => commit(Updaters.moveExperience(resume, i, -1)) : undefined}
                      onMoveDown={
                        i < resume.experience.length - 1 ? () => commit(Updaters.moveExperience(resume, i, 1)) : undefined
                      }
                      onRemove={() => commit(Updaters.removeExperience(resume, i))}
                      removeLabel="Remove role"
                    />
                  )}
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
                onBulletMove={(bulletIndex, direction) =>
                  commit(Updaters.moveExperienceBullet(resume, i, bulletIndex, direction))
                }
              />
            )}
            {editable && <AddButton label="+ Add bullet" onClick={() => commit(Updaters.addExperienceBullet(resume, i))} />}
          </div>
        );
      })}
      {editable && <AddButton label="+ Add role" onClick={() => commit(Updaters.addExperience(resume))} />}
    </div>
  );

  // Section 3: Skills Block
  const skillsSection = resume.skills.length > 0 || editable ? (
    <div key="skills" {...getZoneProps("skills", "Key skills")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{skillsTitle}</h2>
      <div style={styles.skillsGrid}>
        {resume.skills.map((skill, i) =>
          editable ? (
            <p key={i} style={{ ...styles.skillItem, display: "flex", alignItems: "center", gap: "4px" }}>
              •{" "}
              <EditableField
                value={skill}
                onChange={(value) => change(Updaters.setSkills(resume, resume.skills.map((s, si) => (si === i ? value : s))))}
                onBlur={onFieldBlur}
                ariaLabel="Skill"
              />
              <button
                type="button"
                aria-label="Remove skill"
                className="print:hidden"
                onClick={() => commit(Updaters.setSkills(resume, resume.skills.filter((_, si) => si !== i)))}
              >
                <TrashIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
              </button>
            </p>
          ) : (
            <p key={i} style={styles.skillItem}>
              • {skill}
            </p>
          )
        )}
      </div>
      {editable && <AddButton label="+ Add skill" onClick={() => commit(Updaters.setSkills(resume, [...resume.skills, ""]))} />}
    </div>
  ) : null;

  // Section 4: Tools Block
  const toolsSection = (resume.tools && resume.tools.length > 0) || editable ? (
    <div key="tools" {...getZoneProps("tools", "Tools and platforms")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{toolsTitle}</h2>
      {(resume.tools ?? []).map((tool, i) => (
        <div key={i} style={editable ? { display: "flex", alignItems: "center", gap: "4px" } : undefined}>
          <div style={{ flex: 1 }}>
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
          </div>
          {editable && (
            <button
              type="button"
              aria-label="Remove tool"
              className="print:hidden"
              onClick={() => commit(Updaters.setTools(resume, resume.tools.filter((_, ti) => ti !== i)))}
            >
              <TrashIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
            </button>
          )}
        </div>
      ))}
      {editable && <AddButton label="+ Add tool category" onClick={() => commit(Updaters.setTools(resume, [...(resume.tools ?? []), ""]))} />}
    </div>
  ) : null;

  // Section 5: Projects Block
  const projectsSection = density.showProjects && (resume.projects.length > 0 || editable) ? (
    <div key="projects" {...getZoneProps("projects", "Projects")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{projectsTitle}</h2>
      {resume.projects.map((project, i) => {
        const projectKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "project" });
        const titleKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "title" });
        const yearKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "year" });
        return (
          <div key={i} style={styles.roleBlock}>
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
                    inputStyle={styles.roleTitle}
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
                  {editable && (
                    <EntryControls onRemove={() => commit(Updaters.removeProject(resume, i))} removeLabel="Remove project" />
                  )}
                </>
              }
            />
            {(project.bullets.length > 0 || editable) && (
              <BulletList
                bullets={project.bullets}
                style={styles}
                targetKind="projectBullet"
                entryIndex={i}
                highlights={highlights}
                onHighlightActivate={onHighlightActivate}
                editable={editable}
                onBulletChange={(bulletIndex, value) => change(Updaters.updateProjectBullet(resume, i, bulletIndex, value))}
                onBulletBlur={onFieldBlur}
                onBulletRemove={(bulletIndex) => commit(Updaters.removeProjectBullet(resume, i, bulletIndex))}
                onBulletMove={(bulletIndex, direction) => commit(Updaters.moveProjectBullet(resume, i, bulletIndex, direction))}
              />
            )}
            {editable && <AddButton label="+ Add bullet" onClick={() => commit(Updaters.addProjectBullet(resume, i))} />}
          </div>
        );
      })}
      {editable && <AddButton label="+ Add project" onClick={() => commit(Updaters.addProject(resume))} />}
    </div>
  ) : null;

  // Section 6: Education Block
  const educationSection = resume.education.length > 0 || editable ? (
    <div key="education" {...getZoneProps("education", "Education")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{educationTitle}</h2>
      {resume.education.map((edu, i) => {
        const degreeKey = factCheckTargetKey({ kind: "education", index: i, field: "degree" });
        const instKey = factCheckTargetKey({ kind: "education", index: i, field: "institution" });
        return (
          <div key={i} style={styles.eduBlock}>
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
                    inputStyle={{ fontStyle: "italic" }}
                    ariaLabel="Institution"
                  >
                    {edu.institution}
                  </HighlightSpan>
                  {editable && (
                    <EntryControls
                      onRemove={() => commit(Updaters.removeEducation(resume, i))}
                      removeLabel="Remove qualification"
                    />
                  )}
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
          </div>
        );
      })}
      {editable && <AddButton label="+ Add qualification" onClick={() => commit(Updaters.addEducation(resume))} />}
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
  const defaultOrder: ReorderableResumeSection[] =
    tokens.sectionOrder === "skills_first"
      ? ["summary", "skills", "tools", "experience", "projects", "education"]
      : DEFAULT_RESUME_SECTION_ORDER;
  const sectionOrder = resume.section_order ?? defaultOrder;

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
          <div style={styles.positioning} {...getZoneProps("target_titles", "Positioning line")}>
            {editable ? (
              <>
                {resume.target_titles.map((title, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
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
                    <button
                      type="button"
                      aria-label="Remove positioning title"
                      className="print:hidden"
                      onClick={() =>
                        commit(Updaters.setTargetTitles(resume, resume.target_titles.filter((_, ti) => ti !== i)))
                      }
                    >
                      <TrashIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
                    </button>
                  </span>
                ))}
                <AddButton
                  label="+ Add title"
                  onClick={() => commit(Updaters.setTargetTitles(resume, [...resume.target_titles, ""]))}
                />
              </>
            ) : isClassic ? (
              resume.target_titles.join(" · ")
            ) : (
              resume.target_titles.map((title) => `· ${title}`).join(" ")
            )}
          </div>
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

      {density.showRefereeLine && (
        <p style={styles.refereeLine} {...getZoneProps("referees", "Referees")}>
          {Array.isArray(resume.referees) && resume.referees.length > 0
            ? `Referees: ${resume.referees.map((r) => (typeof r === "string" ? r : (r as any).name ?? "")).filter(Boolean).join(", ")}`
            : typeof (resume.referees as unknown) === "string" && (resume.referees as unknown as string).trim()
            ? `Referees: ${resume.referees as unknown as string}`
            : "Referees available upon request"}
        </p>
      )}
    </div>
  );
}




