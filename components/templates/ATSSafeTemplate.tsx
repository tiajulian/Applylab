import type { ResumeContent } from "@/types";

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#1a1a1a",
    fontSize: "11pt",
    lineHeight: 1.5,
    padding: "0",
  },
  name: { fontSize: "20pt", fontWeight: 700, margin: 0 },
  contactLine: { fontSize: "10pt", color: "#333", margin: "4px 0 0" },
  workRights: { fontSize: "10pt", fontWeight: 700, margin: "8px 0 0" },
  sectionTitle: {
    fontSize: "11pt",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #1a1a1a",
    paddingBottom: "2px",
    margin: "18px 0 8px",
  },
  jobHeader: { display: "flex", justifyContent: "space-between", fontWeight: 700 },
  jobMeta: { fontSize: "9.5pt", color: "#444", margin: "2px 0 6px" },
  bullet: { margin: "2px 0", paddingLeft: "14px" },
};

export function ATSSafeTemplate({ resume }: { resume: ResumeContent }) {
  return (
    <div style={styles.page}>
      <h1 style={styles.name}>{resume.contact.name}</h1>
      <p style={styles.contactLine}>
        {[resume.contact.phone, resume.contact.email, resume.contact.location]
          .filter(Boolean)
          .join(" | ")}
      </p>
      {resume.contact.linkedin && <p style={styles.contactLine}>{resume.contact.linkedin}</p>}
      {resume.contact.work_rights && <p style={styles.workRights}>{resume.contact.work_rights}</p>}

      <h2 style={styles.sectionTitle}>Professional Summary</h2>
      <p style={{ margin: 0 }}>{resume.summary}</p>

      <h2 style={styles.sectionTitle}>Key Skills</h2>
      <ul style={{ margin: 0, paddingLeft: "18px" }}>
        {resume.skills.map((skill, i) => (
          <li key={i} style={styles.bullet}>
            {skill}
          </li>
        ))}
      </ul>

      <h2 style={styles.sectionTitle}>Work Experience</h2>
      {resume.experience.map((job, i) => (
        <div key={i} style={{ marginBottom: "12px" }}>
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
          <div style={{ fontWeight: 700 }}>{ref.name}</div>
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
