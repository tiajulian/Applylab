/**
 * RULE ZERO: THE RESUME IS NOT AN ORGANIC SURFACE.
 *
 * Organic governs the app chrome around the resume — modals, buttons, tabs, cards.
 * The resume itself is a printable A4 document read by automated ATS parsers and hiring managers.
 * It strictly uses system fonts, black text (with single curated accent in Modern), and white background.
 * NEVER apply Caprasimo, cream ground, terracotta accents, rounded corners (--radius-*), or any
 * Organic design token to a resume page.
 */

import type { CSSProperties, ReactNode } from "react";
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
import { BulletList, HighlightSpan, RoleHeaderLine, ToolRow } from "@/components/templates/shared";

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
}: {
  resume: ResumeContent;
  tokens: TemplateTokens;
  density?: TemplateDensity;
  accentColor?: string | null;
  highlights?: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
  activeSection?: string | null;
  onSectionClick?: (sectionId: string) => void;
}) {
  const styles = buildTemplateStyles(tokens, density, accentColor);
  const isClassic = tokens.headerAlignment === "center" && tokens.locationStyle === "subline_italic";
  const isIsoDates = tokens.dateFormat === "iso_mono";

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
        <HighlightSpan targetKey="summary" highlight={highlights.summary} onActivate={onHighlightActivate}>
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

        return (
          <div key={i} style={styles.roleBlock}>
            <RoleHeaderLine
              style={styles}
              dates={
                <HighlightSpan
                  targetKey={datesKey}
                  highlight={highlights[roleKey] ?? highlights[datesKey]}
                  onActivate={onHighlightActivate}
                >
                  {dateFormatted}
                </HighlightSpan>
              }
              left={
                <>
                  <HighlightSpan
                    as="strong"
                    targetKey={jobTitleKey}
                    highlight={highlights[roleKey] ?? highlights[jobTitleKey]}
                    onActivate={onHighlightActivate}
                  >
                    <span style={styles.roleTitle}>{job.job_title}</span>
                  </HighlightSpan>
                  {" · "}
                  <HighlightSpan
                    as="i"
                    targetKey={companyKey}
                    highlight={highlights[roleKey] ?? highlights[companyKey]}
                    onActivate={onHighlightActivate}
                  >
                    {job.company}
                  </HighlightSpan>
                  {!isClassic && job.location ? ` ${EM_DASH} ${job.location}` : ""}
                </>
              }
            />
            {isClassic && job.location && (
              <p style={styles.sublineLocation}>{job.location}</p>
            )}
            {job.bullets.length > 0 && (
              <BulletList
                bullets={job.bullets}
                style={styles}
                targetKind="experienceBullet"
                entryIndex={i}
                highlights={highlights}
                onHighlightActivate={onHighlightActivate}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // Section 3: Skills Block
  const skillsSection = resume.skills.length > 0 ? (
    <div key="skills" {...getZoneProps("skills", "Key skills")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{skillsTitle}</h2>
      <div style={styles.skillsGrid}>
        {resume.skills.map((skill, i) => (
          <p key={i} style={styles.skillItem}>
            • {skill}
          </p>
        ))}
      </div>
    </div>
  ) : null;

  // Section 4: Tools Block
  const toolsSection = resume.tools && resume.tools.length > 0 ? (
    <div key="tools" {...getZoneProps("tools", "Tools and platforms")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{toolsTitle}</h2>
      {resume.tools.map((tool, i) => (
        <ToolRow
          key={i}
          tool={tool}
          index={i}
          style={styles.toolRow}
          labelStyle={styles.toolLabel}
          highlights={highlights}
          onHighlightActivate={onHighlightActivate}
        />
      ))}
    </div>
  ) : null;

  // Section 5: Projects Block
  const projectsSection = density.showProjects && resume.projects && resume.projects.length > 0 ? (
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
                project.year ? (
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
                  >
                    <span style={styles.roleTitle}>{project.title}</span>
                  </HighlightSpan>
                  {project.context && (
                    <>
                      {" · "}
                      <span style={{ color: "#475569" }}>{project.context}</span>
                    </>
                  )}
                </>
              }
            />
            {project.bullets.length > 0 && (
              <BulletList
                bullets={project.bullets}
                style={styles}
                targetKind="projectBullet"
                entryIndex={i}
                highlights={highlights}
                onHighlightActivate={onHighlightActivate}
              />
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  // Section 6: Education Block
  const educationSection = resume.education.length > 0 ? (
    <div key="education" {...getZoneProps("education", "Education")}>
      <h2 style={styles.sectionTitle}>{headingPrefix}{educationTitle}</h2>
      {resume.education.map((edu, i) => {
        const degreeKey = factCheckTargetKey({ kind: "education", index: i, field: "degree" });
        const instKey = factCheckTargetKey({ kind: "education", index: i, field: "institution" });
        return (
          <div key={i} style={styles.eduBlock}>
            <RoleHeaderLine
              style={styles}
              dates={edu.year ? emDashifyRange(edu.year) : null}
              left={
                <>
                  <HighlightSpan
                    as="strong"
                    targetKey={degreeKey}
                    highlight={highlights[degreeKey]}
                    onActivate={onHighlightActivate}
                  >
                    {edu.degree}
                  </HighlightSpan>
                  {" · "}
                  <HighlightSpan
                    as="i"
                    targetKey={instKey}
                    highlight={highlights[instKey]}
                    onActivate={onHighlightActivate}
                  >
                    {edu.institution}
                  </HighlightSpan>
                </>
              }
            />
            {edu.notes && <p style={styles.eduNotes}>{edu.notes}</p>}
          </div>
        );
      })}
    </div>
  ) : null;

  // Render sections in template-prescribed order (Technical promotes Skills & Tools above Experience)
  const isSkillsFirst = tokens.sectionOrder === "skills_first";

  return (
    <div style={styles.page}>
      {/* Header & Contact Zone */}
      <div style={styles.header} {...getZoneProps("contact", "Contact")}>
        <h1 style={styles.name}>{resume.contact.name}</h1>
        {resume.target_titles.length > 0 && (
          <p
            style={styles.positioning}
            {...getZoneProps("target_titles", "Positioning line")}
          >
            {isClassic
              ? resume.target_titles.join(" · ")
              : resume.target_titles.map((title) => `· ${title}`).join(" ")}
          </p>
        )}
        {contactParts.length > 0 && (
          <p style={styles.contactLine}>
            {contactParts.join(" | ")}
            {resume.contact.linkedin ? ` | ${resume.contact.linkedin}` : ""}
          </p>
        )}
      </div>

      {summarySection}

      {isSkillsFirst ? (
        <>
          {skillsSection}
          {toolsSection}
          {experienceSection}
        </>
      ) : (
        <>
          {experienceSection}
          {skillsSection}
          {toolsSection}
        </>
      )}

      {projectsSection}
      {educationSection}

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




