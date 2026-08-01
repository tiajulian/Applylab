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
    contactLine: { fontSize: `${fontPt - 0.5}pt`, color: "#475569", margin: `${px(5, spacingScale)} 0 0` },
    workRights: { fontSize: `${fontPt - 0.5}pt`, fontWeight: 700, color: ACCENT, margin: `${px(5, spacingScale)} 0 0` },
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
    skillRow: { margin: `${px(3, spacingScale)} 0` },
    skillLabel: { color: ACCENT },
    roleBlock: { marginBottom: px(10, spacingScale) },
    roleHeader: { display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0f172a" },
    roleMeta: {
      fontSize: `${fontPt - 1}pt`,
      color: "#64748b",
      fontStyle: "italic",
      margin: `${px(1, spacingScale)} 0 ${px(4, spacingScale)}`,
    },
    bullet: { margin: `${px(1.5, spacingScale)} 0`, paddingLeft: "14px" },
    eduBlock: { marginBottom: px(5, spacingScale) },
    refereeLine: { marginTop: px(10, spacingScale), fontSize: `${fontPt - 0.5}pt`, color: "#64748b" },
  };
}

function SkillRow({
  skill,
  style,
  labelStyle,
}: {
  skill: string;
  style: React.CSSProperties;
  labelStyle: React.CSSProperties;
}) {
  const separator = skill.indexOf(":");
  if (separator === -1) {
    return <p style={style}>{skill}</p>;
  }
  return (
    <p style={style}>
      <strong style={labelStyle}>{skill.slice(0, separator + 1)}</strong>
      {skill.slice(separator + 1)}
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
  const contactParts = [resume.contact.phone, resume.contact.email, resume.contact.linkedin].filter(Boolean);

  return (
    <div style={styles.page}>
      <div style={styles.headerBand}>
        <h1 style={styles.name}>{resume.contact.name}</h1>
        {contactParts.length > 0 && <p style={styles.contactLine}>{contactParts.join("  ·  ")}</p>}
        {resume.contact.work_rights && <p style={styles.workRights}>{resume.contact.work_rights}</p>}
      </div>

      <h2 style={styles.sectionTitle}>Professional Summary</h2>
      <p style={{ margin: 0 }}>{resume.summary}</p>

      <h2 style={styles.sectionTitle}>Key Skills</h2>
      {resume.skills.map((skill, i) => (
        <SkillRow key={i} skill={skill} style={styles.skillRow} labelStyle={styles.skillLabel} />
      ))}

      <h2 style={styles.sectionTitle}>Work Experience</h2>
      {resume.experience.map((job, i) => (
        <div key={i} style={styles.roleBlock}>
          <div style={styles.roleHeader}>
            <span>{job.job_title}</span>
            <span>
              {job.start_date} - {job.end_date}
            </span>
          </div>
          <p style={styles.roleMeta}>{[job.company, job.location].filter(Boolean).join(", ")}</p>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {job.bullets.map((bullet, j) => (
              <li key={j} style={styles.bullet}>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h2 style={styles.sectionTitle}>Education</h2>
      {resume.education.map((edu, i) => (
        <div key={i} style={styles.eduBlock}>
          <div style={styles.roleHeader}>
            <span>
              {edu.degree}
              {edu.institution ? ", " : ""}
              <i>{edu.institution}</i>
            </span>
            <span>{edu.year}</span>
          </div>
          {edu.notes && <p style={styles.roleMeta}>{edu.notes}</p>}
        </div>
      ))}

      {density.showRefereeLine && resume.referees.length > 0 && (
        <p style={styles.refereeLine}>Referees available on request.</p>
      )}
    </div>
  );
}
