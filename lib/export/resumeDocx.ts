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
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import type { ResumeContent, Template } from "@/types";

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

function contactLine(resume: ResumeContent, sizes: DocxSizes, font: string): Paragraph {
  const parts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
    resume.contact.linkedin,
  ].filter(Boolean);
  return new Paragraph({
    spacing: { after: 120, line: BODY_LINE },
    children: [new TextRun({ text: parts.join(" | "), font, size: sizes.small, color: "444444" })],
  });
}

function positioningLine(resume: ResumeContent, sizes: DocxSizes, font: string, accentHex: string): Paragraph | null {
  if (resume.target_titles.length === 0) return null;
  return new Paragraph({
    spacing: { after: 30, line: BODY_LINE },
    children: [
      new TextRun({
        text: resume.target_titles.map((title) => `· ${title}`).join(" "),
        italics: true,
        font,
        size: sizes.body,
        color: accentHex !== "1A1A1A" ? accentHex : "444444",
      }),
    ],
  });
}

function sectionHeading(
  title: string,
  sizes: DocxSizes,
  font: string,
  ruleColor: string,
  headingStyle: string,
  accentHex: string
): Paragraph {
  const isPlain = headingStyle === "plain";
  const isMono = headingStyle === "mono_label";
  const displayTitle = isMono ? `// ${title.toUpperCase()}` : title.toUpperCase();
  const headingFont = isMono ? "Consolas" : font;

  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 90 },
    border: isPlain ? undefined : { bottom: { style: BorderStyle.SINGLE, size: 4, color: ruleColor } },
    children: [
      new TextRun({
        text: displayTitle,
        font: headingFont,
        size: sizes.heading,
        bold: true,
        color: accentHex !== "1A1A1A" ? accentHex : "1A1A1A",
      }),
    ],
  });
}

function bulletParagraph(text: string, sizes: DocxSizes, font: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 30, line: BODY_LINE },
    children: [new TextRun({ text, font, size: sizes.body })],
  });
}

function labelledRow(text: string, sizes: DocxSizes, font: string): Paragraph {
  const separator = text.indexOf(":");
  const children =
    separator === -1
      ? [new TextRun({ text, font, size: sizes.body })]
      : [
          new TextRun({ text: text.slice(0, separator + 1), bold: true, font, size: sizes.body }),
          new TextRun({ text: text.slice(separator + 1), font, size: sizes.body }),
        ];
  return new Paragraph({ spacing: { after: 45, line: BODY_LINE }, children });
}

function headerRow(left: string, right: string, sizes: DocxSizes, font: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 90, after: 20, line: BODY_LINE },
    children: [
      new TextRun({ text: left, bold: true, font, size: sizes.body }),
      new TextRun({ text: `\t${right}`, font, size: sizes.body }),
    ],
  });
}

function experienceHeaderRow(
  jobTitle: string,
  company: string,
  location: string,
  dateRange: string,
  sizes: DocxSizes,
  font: string
): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 90, after: 20, line: BODY_LINE },
    children: [
      new TextRun({ text: jobTitle, bold: true, font, size: sizes.body }),
      new TextRun({ text: " · ", font, size: sizes.body }),
      new TextRun({ text: company, italics: true, font, size: sizes.body }),
      new TextRun({ text: location ? ` ${EM_DASH} ${location}` : "", font, size: sizes.body }),
      new TextRun({ text: `\t${dateRange}`, font, size: sizes.body }),
    ],
  });
}

function metaLine(text: string, sizes: DocxSizes, font: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60, line: BODY_LINE },
    children: [new TextRun({ text, italics: true, font, size: sizes.small, color: "444444" })],
  });
}

function plainParagraph(
  text: string,
  sizes: DocxSizes,
  font: string,
  options: { bold?: boolean; size?: number; lineHeight?: number } = {}
): Paragraph {
  return new Paragraph({
    spacing: { after: 60, line: options.lineHeight ?? BODY_LINE },
    children: [
      new TextRun({ text, bold: options.bold, font, size: options.size ?? sizes.body }),
    ],
  });
}

export async function generateResumeDocx(
  resume: ResumeContent,
  fontSizePt: number = DEFAULT_DENSITY.fontPt,
  template: Template = "clean"
): Promise<Buffer> {
  const definition = getTemplateDefinition(template);
  const font = definition.tokens.docxFont;
  const accentHex = definition.tokens.accentColor ? definition.tokens.accentColor.replace("#", "") : "1A1A1A";
  const ruleColor =
    definition.tokens.ruleStyle === "accent"
      ? accentHex
      : definition.tokens.ruleStyle === "understated"
      ? "A8A29E"
      : "1A1A1A";

  const sizes = sizesFor(fontSizePt);
  const children: Paragraph[] = [];

  const nameFont = definition.tokens.nameStyle.fontFamily
    ? definition.tokens.nameStyle.fontFamily.includes("Georgia")
      ? "Georgia"
      : font
    : font;

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: resume.contact.name,
          font: nameFont,
          size: sizes.name,
          bold: true,
          color: "0F172A",
        }),
      ],
    })
  );

  const positioning = positioningLine(resume, sizes, font, accentHex);
  if (positioning) children.push(positioning);
  children.push(contactLine(resume, sizes, font));

  children.push(sectionHeading("Professional Summary", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex));
  children.push(plainParagraph(resume.summary, sizes, font, { lineHeight: SUMMARY_LINE }));

  children.push(sectionHeading("Professional Experience", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex));
  resume.experience.forEach((job) => {
    children.push(
      experienceHeaderRow(job.job_title, job.company, job.location, `${job.start_date} ${EM_DASH} ${job.end_date}`, sizes, font)
    );
    job.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes, font)));
  });

  if (resume.skills && resume.skills.length > 0) {
    children.push(sectionHeading("Skills & Core Competencies", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex));
    resume.skills.forEach((skill) => children.push(bulletParagraph(skill, sizes, font)));
  }

  if (resume.tools && resume.tools.length > 0) {
    children.push(sectionHeading("Tools & Technologies", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex));
    resume.tools.forEach((tool) => children.push(labelledRow(tool, sizes, font)));
  }

  if (resume.projects && resume.projects.length > 0) {
    children.push(sectionHeading("Key Projects", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex));
    resume.projects.forEach((project) => {
      const left = `${project.title}${project.context ? ` | ${project.context}` : ""}`;
      children.push(headerRow(left, emDashifyRange(project.year), sizes, font));
      project.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes, font)));
    });
  }


  if (resume.education && resume.education.length > 0) {
    children.push(sectionHeading("Education", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex));
    resume.education.forEach((edu) => {
      children.push(headerRow(`${edu.degree}, ${edu.institution}`, emDashifyRange(edu.year), sizes, font));
      if (edu.notes) children.push(metaLine(edu.notes, sizes, font));
    });
  }

  if (Array.isArray(resume.referees) && resume.referees.length > 0) {
    children.push(sectionHeading("Referees", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex));
    resume.referees.forEach((referee) => {
      if (typeof referee === "string") {
        children.push(plainParagraph(referee, sizes, font));
      } else if (referee && typeof referee === "object") {
        children.push(plainParagraph(referee.name, sizes, font, { bold: true }));
        const details = [referee.title, referee.organisation].filter(Boolean).join(", ");
        if (details) children.push(metaLine(details, sizes, font));
        if (referee.phone) children.push(metaLine(referee.phone, sizes, font));
        if (referee.email) children.push(metaLine(referee.email, sizes, font));
      }
    });
  } else if (typeof resume.referees === "string" && resume.referees) {
    children.push(
      new Paragraph({
        spacing: { before: 120, line: BODY_LINE },
        children: [
          new TextRun({
            text: `Referees: ${resume.referees}`,
            font,
            size: sizes.small,
            color: "444444",
          }),
        ],
      })
    );
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
