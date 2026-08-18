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
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import type { ResumeContent } from "@/types";

const FONT = "Arial";
const INK = "1A1A1A";

// Sizes/leading mirror the PDF/preview template tokens in lib/resume/templateDensity.ts and
// components/templates/*.tsx (docx sizes are half-points, so pt * 2). Derived from the chosen
// body size rather than hardcoded, so the DOCX export honours the same font-size choice as the
// on-screen preview and the PDF - deltas between the sizes (name +8, heading +1, small -0.5) stay
// fixed, matching the original hardcoded values at the 10pt default.
interface DocxSizes {
  body: number;
  small: number;
  name: number;
  heading: number;
}

function sizesFor(fontSizePt: number): DocxSizes {
  return {
    body: Math.round(fontSizePt * 2),
    small: Math.round((fontSizePt - 0.5) * 2),
    name: Math.round((fontSizePt + 8) * 2),
    heading: Math.round((fontSizePt + 1) * 2),
  };
}

// docx line spacing is in twentieths of a point with lineRule "auto" (240 = 1.0x).
const BODY_LINE = 288; // 1.2, mirrors LINE_HEIGHT_AT_FULL_SPACING
const SUMMARY_LINE = 300; // 1.25, mirrors SUMMARY_LINE_HEIGHT

function contactLine(resume: ResumeContent, sizes: DocxSizes): Paragraph {
  const parts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
    resume.contact.linkedin,
  ].filter(Boolean);
  return new Paragraph({
    spacing: { after: 120, line: BODY_LINE },
    children: [new TextRun({ text: parts.join(" | "), font: FONT, size: sizes.small })],
  });
}

function positioningLine(resume: ResumeContent, sizes: DocxSizes): Paragraph | null {
  if (resume.target_titles.length === 0) return null;
  return new Paragraph({
    spacing: { after: 30, line: BODY_LINE },
    children: [
      new TextRun({
        text: resume.target_titles.map((title) => `· ${title}`).join(" "),
        italics: true,
        font: FONT,
        size: sizes.body,
      }),
    ],
  });
}

function sectionHeading(title: string, sizes: DocxSizes): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 90 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: INK } },
    children: [new TextRun({ text: title.toUpperCase(), font: FONT, size: sizes.heading, bold: true, color: INK })],
  });
}

function bulletParagraph(text: string, sizes: DocxSizes): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 30, line: BODY_LINE },
    children: [new TextRun({ text, font: FONT, size: sizes.body })],
  });
}

// Tools & Platforms are labelled category rows ("Category label: item, item"), not a flat list -
// bold the label the same way the PDF templates' ToolRow does, no bullet marker.
function labelledRow(text: string, sizes: DocxSizes): Paragraph {
  const separator = text.indexOf(":");
  const children =
    separator === -1
      ? [new TextRun({ text, font: FONT, size: sizes.body })]
      : [
          new TextRun({ text: text.slice(0, separator + 1), bold: true, font: FONT, size: sizes.body }),
          new TextRun({ text: text.slice(separator + 1), font: FONT, size: sizes.body }),
        ];
  return new Paragraph({ spacing: { after: 45, line: BODY_LINE }, children });
}

function headerRow(left: string, right: string, sizes: DocxSizes): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 90, after: 20, line: BODY_LINE },
    children: [
      new TextRun({ text: left, bold: true, font: FONT, size: sizes.body }),
      new TextRun({ text: `\t${right}`, font: FONT, size: sizes.body }),
    ],
  });
}

// Job title bold, company italic (not bold), separated by a hyphen from location - matches
// the reference style this export is being brought closer to. Dates get the same hyphen
// treatment as the PDF templates.
function experienceHeaderRow(
  jobTitle: string,
  company: string,
  location: string,
  dateRange: string,
  sizes: DocxSizes
): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 90, after: 20, line: BODY_LINE },
    children: [
      new TextRun({ text: jobTitle, bold: true, font: FONT, size: sizes.body }),
      new TextRun({ text: " · ", font: FONT, size: sizes.body }),
      new TextRun({ text: company, italics: true, font: FONT, size: sizes.body }),
      new TextRun({ text: location ? ` ${EM_DASH} ${location}` : "", font: FONT, size: sizes.body }),
      new TextRun({ text: `\t${dateRange}`, font: FONT, size: sizes.body }),
    ],
  });
}

function metaLine(text: string, sizes: DocxSizes): Paragraph {
  return new Paragraph({
    spacing: { after: 60, line: BODY_LINE },
    children: [new TextRun({ text, italics: true, font: FONT, size: sizes.small, color: "444444" })],
  });
}

function plainParagraph(
  text: string,
  sizes: DocxSizes,
  options: { bold?: boolean; size?: number; lineHeight?: number } = {}
): Paragraph {
  return new Paragraph({
    spacing: { after: 60, line: options.lineHeight ?? BODY_LINE },
    children: [
      new TextRun({ text, bold: options.bold, font: FONT, size: options.size ?? sizes.body }),
    ],
  });
}

export async function generateResumeDocx(resume: ResumeContent, fontSizePt: number = DEFAULT_DENSITY.fontPt): Promise<Buffer> {
  const sizes = sizesFor(fontSizePt);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: resume.contact.name, font: FONT, size: sizes.name, bold: true, color: INK })],
    })
  );
  const positioning = positioningLine(resume, sizes);
  if (positioning) children.push(positioning);
  children.push(contactLine(resume, sizes));

  children.push(sectionHeading("Professional Summary", sizes));
  children.push(plainParagraph(resume.summary, sizes, { lineHeight: SUMMARY_LINE }));

  children.push(sectionHeading("Professional Experience", sizes));
  resume.experience.forEach((job) => {
    children.push(
      experienceHeaderRow(job.job_title, job.company, job.location, `${job.start_date} ${EM_DASH} ${job.end_date}`, sizes)
    );
    job.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes)));
  });

  if (resume.projects.length > 0) {
    children.push(sectionHeading("Projects", sizes));
    resume.projects.forEach((project) => {
      const left = `${project.title}${project.context ? ` | ${project.context}` : ""}`;
      children.push(headerRow(left, emDashifyRange(project.year), sizes));
      project.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes)));
    });
  }

  if (resume.skills.length > 0) {
    children.push(sectionHeading("Key Skills", sizes));
    resume.skills.forEach((skill) => children.push(bulletParagraph(skill, sizes)));
  }

  if (resume.tools.length > 0) {
    children.push(sectionHeading("Tools & Platforms", sizes));
    resume.tools.forEach((tool) => children.push(labelledRow(tool, sizes)));
  }

  children.push(sectionHeading("Education", sizes));
  resume.education.forEach((edu) => {
    children.push(headerRow(`${edu.degree}, ${edu.institution}`, emDashifyRange(edu.year), sizes));
    if (edu.notes) children.push(metaLine(edu.notes, sizes));
  });

  if (resume.referees.length > 0) {
    children.push(sectionHeading("Referees", sizes));
    resume.referees.forEach((referee) => {
      children.push(plainParagraph(referee.name, sizes, { bold: true }));
      children.push(metaLine(`${referee.title}, ${referee.organisation}`, sizes));
      children.push(metaLine(referee.phone, sizes));
      children.push(metaLine(referee.email, sizes));
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
