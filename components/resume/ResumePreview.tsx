import type { ResumeContent } from "@/types";

export function ResumePreview({ resume }: { resume: ResumeContent }) {
  return (
    <article className="mx-auto w-full max-w-[210mm] rounded-lg border border-gray-200 bg-white p-10 text-sm text-gray-800 shadow-sm">
      <header className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900">{resume.contact.name}</h1>
        <p className="mt-1 text-gray-600">
          {[resume.contact.phone, resume.contact.email, resume.contact.location]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {resume.contact.linkedin && (
          <p className="text-gray-600">{resume.contact.linkedin}</p>
        )}
        {resume.contact.work_rights && (
          <p className="mt-2 font-medium text-gray-900">{resume.contact.work_rights}</p>
        )}
      </header>

      <Section title="Professional Summary">
        <p className="leading-relaxed text-gray-700">{resume.summary}</p>
      </Section>

      <Section title="Key Skills">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-700">
          {resume.skills.map((skill, i) => (
            <li key={i} className="list-disc pl-1 marker:text-gray-400">
              {skill}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Work Experience">
        <div className="flex flex-col gap-5">
          {resume.experience.map((job, i) => (
            <div key={i}>
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <h3 className="font-semibold text-gray-900">
                  {job.job_title} — {job.company}
                </h3>
                <span className="text-xs text-gray-500">
                  {job.start_date} — {job.end_date}
                </span>
              </div>
              <p className="text-xs text-gray-500">{job.location}</p>
              {job.company_description && (
                <p className="mt-1 text-xs italic text-gray-500">{job.company_description}</p>
              )}
              <ul className="mt-2 flex flex-col gap-1">
                {job.bullets.map((bullet, j) => (
                  <li key={j} className="list-disc pl-4 leading-relaxed text-gray-700 marker:text-gray-400">
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Education">
        <div className="flex flex-col gap-2">
          {resume.education.map((edu, i) => (
            <div key={i} className="flex flex-wrap items-baseline justify-between gap-1">
              <span className="font-medium text-gray-900">
                {edu.degree}, {edu.institution}
              </span>
              <span className="text-xs text-gray-500">{edu.year}</span>
              {edu.notes && <p className="w-full text-xs text-gray-500">{edu.notes}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Referees">
        <div className="grid gap-3 sm:grid-cols-2">
          {resume.referees.map((ref, i) => (
            <div key={i} className="text-gray-700">
              <p className="font-medium text-gray-900">{ref.name}</p>
              <p className="text-xs text-gray-500">
                {ref.title}, {ref.organisation}
              </p>
              <p className="text-xs text-gray-500">{ref.phone}</p>
              <p className="text-xs text-gray-500">{ref.email}</p>
            </div>
          ))}
        </div>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
