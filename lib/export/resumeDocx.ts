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
  const parts = [resume.contact.phone, resume.contact.email, resume.contact.location].filter(Boolean);
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: parts.join(" | "), font: FONT, size: 20 })],
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
      spacing: { after: 60 },
      children: [new TextRun({ text: resume.contact.name, font: FONT })],
    })
  );
  children.push(contactLine(resume));
  if (resume.contact.linkedin) {
    children.push(plainParagraph(resume.contact.linkedin, { size: 20 }));
  }
  if (resume.contact.work_rights) {
    children.push(plainParagraph(resume.contact.work_rights, { bold: true, size: 20 }));
  }

  children.push(sectionHeading("Professional Summary"));
  children.push(plainParagraph(resume.summary));

  children.push(sectionHeading("Key Skills"));
  resume.skills.forEach((skill) => children.push(bulletParagraph(skill)));

  children.push(sectionHeading("Work Experience"));
  resume.experience.forEach((job) => {
    children.push(headerRow(`${job.job_title} at ${job.company}`, `${job.start_date} - ${job.end_date}`));
    const meta = [job.location, job.company_description].filter(Boolean).join(" | ");
    if (meta) children.push(metaLine(meta));
    job.bullets.forEach((bullet) => children.push(bulletParagraph(bullet)));
  });

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
