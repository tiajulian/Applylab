import type { ResumeContent } from "@/types";
import { factCheckTargetKey } from "@/types";
import {
  DEFAULT_DENSITY,
  lineHeightFor,
  SUMMARY_LINE_HEIGHT,
  type TemplateDensity,
} from "@/lib/resume/templateDensity";
import { EM_DASH, emDashifyRange, formatDateRange } from "@/lib/resume/formatDateRange";
import { BulletList, HighlightSpan, RoleHeaderLine, ToolRow } from "@/components/templates/shared";

const ACCENT = "#1d4ed8";

function px(basePx: number, scale: number): string {
  return `${Math.round(basePx * scale * 10) / 10}px`;
}

function buildStyles(density: TemplateDensity): Record<string, React.CSSProperties> {
  const { fontPt, spacingScale } = density;
  return {
    page: {
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      color: "#1f2933",
      fontSize: `${fontPt}pt`,
      lineHeight: lineHeightFor(spacingScale),
    },
    headerBand: {
      textAlign: "left",
      borderBottom: `3px solid ${ACCENT}`,
      paddingBottom: px(10, spacingScale),
      marginBottom: px(14, spacingScale),
    },
    name: { fontSize: `${fontPt + 8}pt`, fontWeight: 800, margin: 0, color: "#0f172a" },
    positioning: {
      fontSize: `${fontPt}pt`,
      color: ACCENT,
      fontWeight: 600,
      fontStyle: "italic",
      margin: `${px(4, spacingScale)} 0 0`,
    },
    contactLine: { fontSize: `${fontPt - 0.5}pt`, color: "#475569", margin: `${px(5, spacingScale)} 0 0` },
    sectionTitle: {
      fontSize: `${fontPt + 1}pt`,
      fontWeight: 800,
      color: ACCENT,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      borderBottom: `1px solid ${ACCENT}33`,
      paddingBottom: "2px",
      margin: `${px(11, spacingScale)} 0 ${px(6, spacingScale)}`,
    },
    roleBlock: { marginBottom: px(6, spacingScale) },
    roleHeaderLine: { display: "flex", justifyContent: "space-between", gap: "8px", color: "#0f172a" },
    roleHeaderLeft: { flex: 1 },
    dates: { whiteSpace: "nowrap", color: "#0f172a" },
    bulletList: { listStyle: "none", margin: `${px(3, spacingScale)} 0 0`, padding: 0 },
    bullet: { margin: `0 0 ${px(2, spacingScale)}`, paddingLeft: "14px", textIndent: "-14px" },
    summary: { margin: 0, lineHeight: SUMMARY_LINE_HEIGHT },
    skillsGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      columnGap: "16px",
      rowGap: px(2, spacingScale),
      margin: 0,
    },
    skillItem: { fontSize: `${fontPt}pt` },
    toolRow: { margin: `${px(3, spacingScale)} 0` },
    toolLabel: { color: ACCENT },
    eduBlock: { marginBottom: px(5, spacingScale) },
    eduNotes: { margin: `${px(2, spacingScale)} 0 0`, fontSize: `${fontPt - 1}pt`, color: "#64748b" },
    refereeLine: { marginTop: px(10, spacingScale), fontSize: `${fontPt - 0.5}pt`, color: "#64748b" },
  };
}

export function DesignForwardTemplate({
  resume,
  density = DEFAULT_DENSITY,
  highlights = {},
  onHighlightActivate,
}: {
  resume: ResumeContent;
  density?: TemplateDensity;
  /** Keyed by factCheckTargetKey(target) - "flagged" for an unresolved honesty flag on that
   * element, "active" when that element's fix panel is currently open. Omit (or pass {}) for
   * read-only/export contexts, in which case every element renders exactly as before. */
  highlights?: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
}) {
  const styles = buildStyles(density);
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
  ].filter(Boolean);

  return (
    <div style={styles.page}>
      <div style={styles.headerBand}>
        <h1 style={styles.name}>{resume.contact.name}</h1>
        {resume.target_titles.length > 0 && (
          <p style={styles.positioning}>{resume.target_titles.map((title) => `· ${title}`).join(" ")}</p>
        )}
        {contactParts.length > 0 && (
          <p style={styles.contactLine}>
            {contactParts.join("  ·  ")}
            {resume.contact.linkedin ? `  ·  ${resume.contact.linkedin}` : ""}
          </p>
        )}
      </div>

      <h2 style={styles.sectionTitle}>Professional Summary</h2>
      <p style={styles.summary}>
        <HighlightSpan targetKey="summary" highlight={highlights.summary} onActivate={onHighlightActivate}>
          {resume.summary}
        </HighlightSpan>
      </p>

      <h2 style={styles.sectionTitle}>Professional Experience</h2>
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
            <BulletList
              bullets={job.bullets}
              style={styles}
              targetKind="experienceBullet"
              entryIndex={i}
              highlights={highlights}
              onHighlightActivate={onHighlightActivate}
            />
          </div>
        );
      })}

      {density.showProjects && resume.projects.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Projects</h2>
          {resume.projects.map((project, i) => {
            const projectRoleKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "project" });
            const titleKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "title" });
            const yearKey = factCheckTargetKey({ kind: "projectHeader", index: i, field: "year" });
            return (
              <div key={i} style={styles.roleBlock}>
                <RoleHeaderLine
                  style={styles}
                  dates={
                    <HighlightSpan targetKey={yearKey} highlight={highlights[yearKey]} onActivate={onHighlightActivate}>
                      {emDashifyRange(project.year)}
                    </HighlightSpan>
                  }
                  left={
                    <>
                      <HighlightSpan
                        as="strong"
                        targetKey={titleKey}
                        highlight={highlights[projectRoleKey] ?? highlights[titleKey]}
                        onActivate={onHighlightActivate}
                      >
                        {project.title}
                      </HighlightSpan>
                      {project.context ? ` | ${project.context}` : ""}
                    </>
                  }
                />
                <BulletList
                  bullets={project.bullets}
                  style={styles}
                  targetKind="projectBullet"
                  entryIndex={i}
                  highlights={highlights}
                  onHighlightActivate={onHighlightActivate}
                />
              </div>
            );
          })}
        </>
      )}

      {resume.skills.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Key Skills</h2>
          <div style={styles.skillsGrid}>
            {resume.skills.map((skill, i) => {
              const key = factCheckTargetKey({ kind: "skill", index: i });
              return (
                <div key={i} style={styles.skillItem}>
                  <span aria-hidden="true">• </span>
                  <HighlightSpan targetKey={key} highlight={highlights[key]} onActivate={onHighlightActivate}>
                    {skill}
                  </HighlightSpan>
                </div>
              );
            })}
          </div>
        </>
      )}

      {resume.tools.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Tools &amp; Platforms</h2>
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

      <h2 style={styles.sectionTitle}>Education</h2>
      {resume.education.map((edu, i) => {
        const degreeKey = factCheckTargetKey({ kind: "education", index: i, field: "degree" });
        const institutionKey = factCheckTargetKey({ kind: "education", index: i, field: "institution" });
        return (
          <div key={i} style={styles.eduBlock}>
            <RoleHeaderLine
              style={styles}
              dates={emDashifyRange(edu.year)}
              left={
                <>
                  <HighlightSpan targetKey={degreeKey} highlight={highlights[degreeKey]} onActivate={onHighlightActivate}>
                    {edu.degree}
                  </HighlightSpan>
                  {edu.institution ? ", " : ""}
                  <HighlightSpan
                    as="i"
                    targetKey={institutionKey}
                    highlight={highlights[institutionKey]}
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

      {/* Known limitation: the templates never render individual referees, only this static
          line, so a referee-level honesty flag has no DOM element to anchor an inline highlight
          to. Referee flags still surface via the review counter's collapsed list, fixed from
          there as a centered modal (see FactCheckFixPanel, anchorRect === null). */}
      {density.showRefereeLine && resume.referees.length > 0 && (
        <p style={styles.refereeLine}>Referees available on request.</p>
      )}
    </div>
  );
}
