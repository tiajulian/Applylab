import type { ResumeContent } from "@/types";

const ACCENT = "#1d4ed8";

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    color: "#1f2933",
    fontSize: "11pt",
    lineHeight: 1.55,
  },
  headerBand: {
    borderBottom: `3px solid ${ACCENT}`,
    paddingBottom: "10px",
    marginBottom: "16px",
  },
  name: { fontSize: "24pt", fontWeight: 800, margin: 0, color: "#0f172a" },
  contactLine: { fontSize: "10pt", color: "#475569", margin: "6px 0 0" },
  workRights: { fontSize: "10pt", fontWeight: 700, color: ACCENT, margin: "8px 0 0" },
  sectionTitle: {
    fontSize: "12pt",
    fontWeight: 800,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin: "20px 0 8px",
  },
  jobHeader: { display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0f172a" },
  jobMeta: { fontSize: "9.5pt", color: "#64748b", margin: "2px 0 6px" },
  bullet: { margin: "3px 0", paddingLeft: "14px" },
  skillPill: {
    display: "inline-block",
    border: `1px solid ${ACCENT}`,
    color: ACCENT,
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "9.5pt",
    margin: "0 6px 6px 0",
  },
};

export function DesignForwardTemplate({ resume }: { resume: ResumeContent }) {
  return (
    <div style={styles.page}>
      <div style={styles.headerBand}>
        <h1 style={styles.name}>{resume.contact.name}</h1>
        <p style={styles.contactLine}>
          {[resume.contact.phone, resume.contact.email, resume.contact.location]
            .filter(Boolean)
            .join("  ·  ")}
        </p>
        {resume.contact.linkedin && <p style={styles.contactLine}>{resume.contact.linkedin}</p>}
        {resume.contact.work_rights && (
          <p style={styles.workRights}>{resume.contact.work_rights}</p>
        )}
      </div>

      <h2 style={styles.sectionTitle}>Professional Summary</h2>
      <p style={{ margin: 0 }}>{resume.summary}</p>

      <h2 style={styles.sectionTitle}>Key Skills</h2>
      <div>
        {resume.skills.map((skill, i) => (
          <span key={i} style={styles.skillPill}>
            {skill}
          </span>
        ))}
      </div>

      <h2 style={styles.sectionTitle}>Work Experience</h2>
      {resume.experience.map((job, i) => (
        <div key={i} style={{ marginBottom: "14px" }}>
          <div style={styles.jobHeader}>
            <span>
              {job.job_title} at {job.company}
            </span>
            <span>
              {job.start_date} - {job.end_date}
            </span>
          </div>
          <p style={styles.jobMeta}>
            {[job.location, job.company_description].filter(Boolean).join(" | ")}
          </p>
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
        <div key={i} style={{ marginBottom: "6px" }}>
          <div style={styles.jobHeader}>
            <span>
              {edu.degree}, {edu.institution}
            </span>
            <span>{edu.year}</span>
          </div>
          {edu.notes && <p style={styles.jobMeta}>{edu.notes}</p>}
        </div>
      ))}

      <h2 style={styles.sectionTitle}>Referees</h2>
      {resume.referees.map((ref, i) => (
        <div key={i} style={{ marginBottom: "8px" }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{ref.name}</div>
          <div style={styles.jobMeta}>
            {ref.title}, {ref.organisation}
          </div>
          <div style={styles.jobMeta}>{ref.phone}</div>
          <div style={styles.jobMeta}>{ref.email}</div>
        </div>
      ))}
    </div>
  );
}
