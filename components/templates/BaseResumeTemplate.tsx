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
import { EM_DASH, emDashifyRange, formatDateRange } from "@/lib/resume/formatDateRange";
import { BulletList, HighlightSpan, RoleHeaderLine, ToolRow } from "@/components/templates/shared";

function px(basePx: number, scale: number, densityModifier: number = 1): string {
  return `${Math.round(basePx * scale * densityModifier * 10) / 10}px`;
}

export function buildTemplateStyles(
  tokens: TemplateTokens,
  density: TemplateDensity
): Record<string, CSSProperties> {
  const { fontPt, spacingScale } = density;
  const densityMod = tokens.density === "dense" ? 0.85 : tokens.density === "airy" ? 1.15 : 1.0;
  const accent = tokens.accentColor;

  const sectionTitleStyle: CSSProperties = {
    fontSize: `${fontPt + 1}pt`,
    fontWeight: tokens.nameStyle.fontWeight >= 800 ? 800 : 700,
    fontFamily: tokens.headingFontFamily ?? tokens.fontFamily,
    color: accent ?? "#1a1a1a",
    margin: `${px(11, spacingScale, densityMod)} 0 ${px(6, spacingScale, densityMod)}`,
    paddingBottom: "2px",
    breakInside: "avoid",
    pageBreakInside: "avoid",
    pageBreakAfter: "avoid",
  };

  if (tokens.headingStyle === "caps_rule") {
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.08em";
    sectionTitleStyle.borderBottom = "1px solid #1a1a1a";
  } else if (tokens.headingStyle === "smallcaps_rule") {
    sectionTitleStyle.fontVariant = "small-caps";
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.06em";
    sectionTitleStyle.borderBottom = "1px solid #1a1a1a";
  } else if (tokens.headingStyle === "accent_rule") {
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.06em";
    sectionTitleStyle.borderBottom = `2px solid ${accent ?? "#1e3a8a"}`;
    sectionTitleStyle.paddingBottom = "3px";
  } else if (tokens.headingStyle === "compact_rule") {
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.05em";
    sectionTitleStyle.borderBottom = "1px solid #94a3b8";
    sectionTitleStyle.paddingBottom = "1px";
  } else if (tokens.headingStyle === "editorial_rule") {
    sectionTitleStyle.letterSpacing = "0.04em";
    sectionTitleStyle.borderBottom = "1px solid #94a3b8";
    sectionTitleStyle.fontStyle = "normal";
  } else if (tokens.headingStyle === "mono_label") {
    sectionTitleStyle.fontSize = `${fontPt}pt`;
    sectionTitleStyle.letterSpacing = "0.06em";
    sectionTitleStyle.borderBottom = "1px solid #475569";
  } else if (tokens.headingStyle === "executive_rule") {
    sectionTitleStyle.letterSpacing = "0.05em";
    sectionTitleStyle.borderBottom = "0.75px solid #a8a29e";
    sectionTitleStyle.paddingBottom = "3px";
  } else if (tokens.headingStyle === "plain") {
    sectionTitleStyle.textTransform = "uppercase";
    sectionTitleStyle.letterSpacing = "0.06em";
    sectionTitleStyle.borderBottom = "none";
  }

  return {
    page: {
      fontFamily: tokens.fontFamily,
      color: "#1a1a1a",
      fontSize: `${fontPt}pt`,
      lineHeight: lineHeightFor(spacingScale),
    },
    header: {
      textAlign: "left",
      marginBottom: px(14, spacingScale, densityMod),
    },
    name: {
      fontSize: `${fontPt + tokens.nameStyle.fontPtDelta}pt`,
      fontWeight: tokens.nameStyle.fontWeight,
      fontFamily: tokens.nameStyle.fontFamily ?? tokens.fontFamily,
      textTransform: tokens.nameStyle.casing === "uppercase" ? "uppercase" : "none",
      color: "#0f172a",
      margin: 0,
      letterSpacing: tokens.headingStyle === "editorial_rule" ? "0.01em" : "0.02em",
    },
    positioning: {
      fontSize: `${fontPt}pt`,
      fontStyle: "italic",
      color: accent ?? "#334155",
      fontWeight: accent ? 600 : 400,
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
    dates: {
      whiteSpace: "nowrap",
      color: "#1a1a1a",
      fontFamily: tokens.headingStyle === "mono_label" ? tokens.headingFontFamily : undefined,
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
      color: accent ?? "#1a1a1a",
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
  highlights = {},
  onHighlightActivate,
}: {
  resume: ResumeContent;
  tokens: TemplateTokens;
  density?: TemplateDensity;
  highlights?: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
}) {
  const styles = buildTemplateStyles(tokens, density);
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
  ].filter(Boolean);

  const headingPrefix = tokens.headingStyle === "mono_label" ? "// " : "";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.name}>{resume.contact.name}</h1>
        {resume.target_titles.length > 0 && (
          <p style={styles.positioning}>{resume.target_titles.map((title) => `· ${title}`).join(" ")}</p>
        )}
        {contactParts.length > 0 && (
          <p style={styles.contactLine}>
            {contactParts.join(" | ")}
            {resume.contact.linkedin ? ` | ${resume.contact.linkedin}` : ""}
          </p>
        )}
      </div>

      <h2 style={styles.sectionTitle}>{headingPrefix}Professional Summary</h2>
      <p style={styles.summary}>
        <HighlightSpan targetKey="summary" highlight={highlights.summary} onActivate={onHighlightActivate}>
          {resume.summary}
        </HighlightSpan>
      </p>

      <h2 style={styles.sectionTitle}>{headingPrefix}Professional Experience</h2>
      {resume.experience.map((job, i) => {
        const roleKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "role" });
        const jobTitleKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "job_title" });
        const companyKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "company" });
        const datesKey = factCheckTargetKey({ kind: "experienceHeader", index: i, field: "dates" });
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
                  {formatDateRange(job.start_date, job.end_date)}
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
                    {job.job_title}
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
                  {job.location ? ` ${EM_DASH} ${job.location}` : ""}
                </>
              }
            />
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

      {resume.skills.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>{headingPrefix}Skills & Core Competencies</h2>
          <div style={styles.skillsGrid}>
            {resume.skills.map((skill, i) => (
              <p key={i} style={styles.skillItem}>
                • {skill}
              </p>
            ))}
          </div>
        </>
      )}

      {resume.tools && resume.tools.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>{headingPrefix}Tools & Technologies</h2>
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
        </>
      )}

      {density.showProjects && resume.projects && resume.projects.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>{headingPrefix}Key Projects</h2>
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
                        {project.title}
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
        </>
      )}

      {resume.education.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>{headingPrefix}Education</h2>
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
        </>
      )}


      {density.showRefereeLine && (
        <p style={styles.refereeLine}>
          {resume.referees ? `Referees: ${resume.referees}` : "Referees available upon request"}
        </p>
      )}
    </div>
  );
}
