import type { ResumeContent } from "@/types";
import { DEFAULT_DENSITY, lineHeightFor, type TemplateDensity } from "@/lib/resume/templateDensity";

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
      textAlign: "center",
      borderBottom: `3px solid ${ACCENT}`,
      paddingBottom: px(10, spacingScale),
      marginBottom: px(14, spacingScale),
    },
    name: { fontSize: `${fontPt + 10}pt`, fontWeight: 800, margin: 0, color: "#0f172a" },
    positioning: { fontSize: `${fontPt}pt`, color: ACCENT, fontWeight: 600, margin: `${px(4, spacingScale)} 0 0` },
    contactLine: { fontSize: `${fontPt - 0.5}pt`, color: "#475569", margin: `${px(5, spacingScale)} 0 0` },
    sectionTitle: {
      fontSize: `${fontPt + 0.5}pt`,
      fontWeight: 800,
      color: ACCENT,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      borderBottom: `1px solid ${ACCENT}33`,
      paddingBottom: "2px",
      margin: `${px(16, spacingScale)} 0 ${px(6, spacingScale)}`,
    },
    roleBlock: { marginBottom: px(10, spacingScale) },
    roleHeaderLine: { display: "flex", justifyContent: "space-between", gap: "8px", color: "#0f172a" },
    roleHeaderLeft: { flex: 1 },
    dates: { whiteSpace: "nowrap", color: "#0f172a" },
    bulletList: { listStyle: "none", margin: `${px(3, spacingScale)} 0 0`, padding: 0 },
    bullet: { margin: `${px(1.5, spacingScale)} 0`, paddingLeft: "14px", textIndent: "-14px" },
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

function RoleHeaderLine({
  left,
  dates,
  style,
}: {
  left: React.ReactNode;
  dates: string;
  style: Record<string, React.CSSProperties>;
}) {
  return (
    <div style={style.roleHeaderLine}>
      <span style={style.roleHeaderLeft}>{left}</span>
      <span style={style.dates}>{dates}</span>
    </div>
  );
}

function BulletList({ bullets, style }: { bullets: string[]; style: Record<string, React.CSSProperties> }) {
  return (
    <ul style={style.bulletList}>
      {bullets.map((bullet, j) => (
        <li key={j} style={style.bullet}>
          <span aria-hidden="true">▸ </span>
          {bullet}
        </li>
      ))}
    </ul>
  );
}

function ToolRow({
  tool,
  style,
  labelStyle,
}: {
  tool: string;
  style: React.CSSProperties;
  labelStyle: React.CSSProperties;
}) {
  const separator = tool.indexOf(":");
  if (separator === -1) {
    return <p style={style}>{tool}</p>;
  }
  return (
    <p style={style}>
      <strong style={labelStyle}>{tool.slice(0, separator + 1)}</strong>
      {tool.slice(separator + 1)}
    </p>
  );
}

export function DesignForwardTemplate({
  resume,
  density = DEFAULT_DENSITY,
}: {
  resume: ResumeContent;
  density?: TemplateDensity;
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
          <p style={styles.positioning}>{resume.target_titles.join(" · ")}</p>
        )}
        {contactParts.length > 0 && (
          <p style={styles.contactLine}>
            {contactParts.join("  ·  ")}
            {resume.contact.linkedin ? `  ·  ${resume.contact.linkedin}` : ""}
          </p>
        )}
      </div>

      <h2 style={styles.sectionTitle}>Professional Summary</h2>
      <p style={{ margin: 0 }}>{resume.summary}</p>

      <h2 style={styles.sectionTitle}>Professional Experience</h2>
      {resume.experience.map((job, i) => (
        <div key={i} style={styles.roleBlock}>
          <RoleHeaderLine
            style={styles}
            dates={`${job.start_date} - ${job.end_date}`}
            left={
              <>
                <strong>{job.job_title}</strong> · <strong>{job.company}</strong>
                {job.location ? `, ${job.location}` : ""}
              </>
            }
          />
          <BulletList bullets={job.bullets} style={styles} />
        </div>
      ))}

      {density.showProjects && resume.projects.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Projects</h2>
          {resume.projects.map((project, i) => (
            <div key={i} style={styles.roleBlock}>
              <RoleHeaderLine
                style={styles}
                dates={project.year}
                left={
                  <>
                    <strong>{project.title}</strong>
                    {project.context ? ` | ${project.context}` : ""}
                  </>
                }
              />
              <BulletList bullets={project.bullets} style={styles} />
            </div>
          ))}
        </>
      )}

      <h2 style={styles.sectionTitle}>Key Skills</h2>
      <div style={styles.skillsGrid}>
        {resume.skills.map((skill, i) => (
          <div key={i} style={styles.skillItem}>
            {skill}
          </div>
        ))}
      </div>

      <h2 style={styles.sectionTitle}>Tools &amp; Platforms</h2>
      {resume.tools.map((tool, i) => (
        <ToolRow key={i} tool={tool} style={styles.toolRow} labelStyle={styles.toolLabel} />
      ))}

      <h2 style={styles.sectionTitle}>Education</h2>
      {resume.education.map((edu, i) => (
        <div key={i} style={styles.eduBlock}>
          <RoleHeaderLine
            style={styles}
            dates={edu.year}
            left={
              <>
                {edu.degree}
                {edu.institution ? ", " : ""}
                <i>{edu.institution}</i>
              </>
            }
          />
          {edu.notes && <p style={styles.eduNotes}>{edu.notes}</p>}
        </div>
      ))}

      {density.showRefereeLine && resume.referees.length > 0 && (
        <p style={styles.refereeLine}>Referees available on request.</p>
      )}
    </div>
  );
}
