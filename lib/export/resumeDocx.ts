import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import type { ResumeContent } from "@/types";

const FONT = "Arial";

function contactLine(resume: ResumeContent): Paragraph {
  const parts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
    resume.contact.linkedin,
  ].filter(Boolean);
  return new Paragraph({
    alignment: "center",
    spacing: { after: 80 },
    children: [new TextRun({ text: parts.join(" | "), font: FONT, size: 20 })],
  });
}

function positioningLine(resume: ResumeContent): Paragraph | null {
  if (resume.target_titles.length === 0) return null;
  return new Paragraph({
    alignment: "center",
    spacing: { after: 40 },
    children: [new TextRun({ text: resume.target_titles.join(" · "), font: FONT, size: 21 })],
  });
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: title.toUpperCase(), font: FONT })],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}

// Tools & Platforms are labelled category rows ("Category label: item, item"), not a flat list -
// bold the label the same way the PDF templates' ToolRow does, no bullet marker.
function labelledRow(text: string): Paragraph {
  const separator = text.indexOf(":");
  const children =
    separator === -1
      ? [new TextRun({ text, font: FONT, size: 22 })]
      : [
          new TextRun({ text: text.slice(0, separator + 1), bold: true, font: FONT, size: 22 }),
          new TextRun({ text: text.slice(separator + 1), font: FONT, size: 22 }),
        ];
  return new Paragraph({ spacing: { after: 60 }, children });
}

function headerRow(left: string, right: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: 20 },
    children: [
      new TextRun({ text: left, bold: true, font: FONT, size: 22 }),
      new TextRun({ text: `\t${right}`, font: FONT, size: 22 }),
    ],
  });
}

function metaLine(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, italics: true, font: FONT, size: 19, color: "444444" })],
  });
}

function plainParagraph(text: string, options: { bold?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text, bold: options.bold, font: FONT, size: options.size ?? 22 }),
    ],
  });
}

export async function generateResumeDocx(resume: ResumeContent): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: "center",
      spacing: { after: 60 },
      children: [new TextRun({ text: resume.contact.name, font: FONT })],
    })
  );
  const positioning = positioningLine(resume);
  if (positioning) children.push(positioning);
  children.push(contactLine(resume));

  children.push(sectionHeading("Professional Summary"));
  children.push(plainParagraph(resume.summary));

  children.push(sectionHeading("Professional Experience"));
  resume.experience.forEach((job) => {
    const left = `${job.job_title} · ${job.company}${job.location ? `, ${job.location}` : ""}`;
    children.push(headerRow(left, `${job.start_date} - ${job.end_date}`));
    job.bullets.forEach((bullet) => children.push(bulletParagraph(bullet)));
  });

  if (resume.projects.length > 0) {
    children.push(sectionHeading("Projects"));
    resume.projects.forEach((project) => {
      const left = `${project.title}${project.context ? ` | ${project.context}` : ""}`;
      children.push(headerRow(left, project.year));
      project.bullets.forEach((bullet) => children.push(bulletParagraph(bullet)));
    });
  }

  children.push(sectionHeading("Key Skills"));
  resume.skills.forEach((skill) => children.push(bulletParagraph(skill)));

  children.push(sectionHeading("Tools & Platforms"));
  resume.tools.forEach((tool) => children.push(labelledRow(tool)));

  children.push(sectionHeading("Education"));
  resume.education.forEach((edu) => {
    children.push(headerRow(`${edu.degree}, ${edu.institution}`, edu.year));
    if (edu.notes) children.push(metaLine(edu.notes));
  });

  children.push(sectionHeading("Referees"));
  resume.referees.forEach((referee) => {
    children.push(plainParagraph(referee.name, { bold: true }));
    children.push(metaLine(`${referee.title}, ${referee.organisation}`));
    children.push(metaLine(referee.phone));
    children.push(metaLine(referee.email));
  });

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
