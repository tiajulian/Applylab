import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import { EM_DASH, emDashifyRange } from "@/lib/resume/formatDateRange";
import type { ResumeContent } from "@/types";

const FONT = "Arial";

// Sizes/leading mirror the PDF/preview template tokens in lib/resume/templateDensity.ts and
// components/templates/*.tsx (docx sizes are half-points, so pt * 2).
const BODY_SIZE = 20; // 10pt
const SMALL_SIZE = 19; // 9.5pt - contact line, meta lines
const NAME_SIZE = 36; // 18pt
const HEADING_SIZE = 22; // 11pt
const INK = "1A1A1A";

// docx line spacing is in twentieths of a point with lineRule "auto" (240 = 1.0x).
const BODY_LINE = 288; // 1.2, mirrors LINE_HEIGHT_AT_FULL_SPACING
const SUMMARY_LINE = 300; // 1.25, mirrors SUMMARY_LINE_HEIGHT

function contactLine(resume: ResumeContent): Paragraph {
  const parts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
    resume.contact.linkedin,
  ].filter(Boolean);
  return new Paragraph({
    spacing: { after: 120, line: BODY_LINE },
    children: [new TextRun({ text: parts.join(" | "), font: FONT, size: SMALL_SIZE })],
  });
}

function positioningLine(resume: ResumeContent): Paragraph | null {
  if (resume.target_titles.length === 0) return null;
  return new Paragraph({
    spacing: { after: 30, line: BODY_LINE },
    children: [
      new TextRun({
        text: resume.target_titles.map((title) => `· ${title}`).join(" "),
        italics: true,
        font: FONT,
        size: BODY_SIZE,
      }),
    ],
  });
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 90 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: INK } },
    children: [new TextRun({ text: title.toUpperCase(), font: FONT, size: HEADING_SIZE, bold: true, color: INK })],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 30, line: BODY_LINE },
    children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
  });
}

// Tools & Platforms are labelled category rows ("Category label: item, item"), not a flat list -
// bold the label the same way the PDF templates' ToolRow does, no bullet marker.
function labelledRow(text: string): Paragraph {
  const separator = text.indexOf(":");
  const children =
    separator === -1
      ? [new TextRun({ text, font: FONT, size: BODY_SIZE })]
      : [
          new TextRun({ text: text.slice(0, separator + 1), bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: text.slice(separator + 1), font: FONT, size: BODY_SIZE }),
        ];
  return new Paragraph({ spacing: { after: 45, line: BODY_LINE }, children });
}

function headerRow(left: string, right: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 90, after: 20, line: BODY_LINE },
    children: [
      new TextRun({ text: left, bold: true, font: FONT, size: BODY_SIZE }),
      new TextRun({ text: `\t${right}`, font: FONT, size: BODY_SIZE }),
    ],
  });
}

// Job title bold, company italic (not bold), separated by a hyphen from location - matches
// the reference style this export is being brought closer to. Dates get the same hyphen
// treatment as the PDF templates.
function experienceHeaderRow(jobTitle: string, company: string, location: string, dateRange: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 90, after: 20, line: BODY_LINE },
    children: [
      new TextRun({ text: jobTitle, bold: true, font: FONT, size: BODY_SIZE }),
      new TextRun({ text: " · ", font: FONT, size: BODY_SIZE }),
      new TextRun({ text: company, italics: true, font: FONT, size: BODY_SIZE }),
      new TextRun({ text: location ? ` ${EM_DASH} ${location}` : "", font: FONT, size: BODY_SIZE }),
      new TextRun({ text: `\t${dateRange}`, font: FONT, size: BODY_SIZE }),
    ],
  });
}

function metaLine(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60, line: BODY_LINE },
    children: [new TextRun({ text, italics: true, font: FONT, size: SMALL_SIZE, color: "444444" })],
  });
}

function plainParagraph(
  text: string,
  options: { bold?: boolean; size?: number; lineHeight?: number } = {}
): Paragraph {
  return new Paragraph({
    spacing: { after: 60, line: options.lineHeight ?? BODY_LINE },
    children: [
      new TextRun({ text, bold: options.bold, font: FONT, size: options.size ?? BODY_SIZE }),
    ],
  });
}

export async function generateResumeDocx(resume: ResumeContent): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: resume.contact.name, font: FONT, size: NAME_SIZE, bold: true, color: INK })],
    })
  );
  const positioning = positioningLine(resume);
  if (positioning) children.push(positioning);
  children.push(contactLine(resume));

  children.push(sectionHeading("Professional Summary"));
  children.push(plainParagraph(resume.summary, { lineHeight: SUMMARY_LINE }));

  children.push(sectionHeading("Professional Experience"));
  resume.experience.forEach((job) => {
    children.push(experienceHeaderRow(job.job_title, job.company, job.location, `${job.start_date} ${EM_DASH} ${job.end_date}`));
    job.bullets.forEach((bullet) => children.push(bulletParagraph(bullet)));
  });

  if (resume.projects.length > 0) {
    children.push(sectionHeading("Projects"));
    resume.projects.forEach((project) => {
      const left = `${project.title}${project.context ? ` | ${project.context}` : ""}`;
      children.push(headerRow(left, emDashifyRange(project.year)));
      project.bullets.forEach((bullet) => children.push(bulletParagraph(bullet)));
    });
  }

  if (resume.skills.length > 0) {
    children.push(sectionHeading("Key Skills"));
    resume.skills.forEach((skill) => children.push(bulletParagraph(skill)));
  }

  if (resume.tools.length > 0) {
    children.push(sectionHeading("Tools & Platforms"));
    resume.tools.forEach((tool) => children.push(labelledRow(tool)));
  }

  children.push(sectionHeading("Education"));
  resume.education.forEach((edu) => {
    children.push(headerRow(`${edu.degree}, ${edu.institution}`, emDashifyRange(edu.year)));
    if (edu.notes) children.push(metaLine(edu.notes));
  });

  if (resume.referees.length > 0) {
    children.push(sectionHeading("Referees"));
    resume.referees.forEach((referee) => {
      children.push(plainParagraph(referee.name, { bold: true }));
      children.push(metaLine(`${referee.title}, ${referee.organisation}`));
      children.push(metaLine(referee.phone));
      children.push(metaLine(referee.email));
    });
  }

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
