import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import { EM_DASH, emDashifyRange, formatDateRange, formatIsoDateRange } from "@/lib/resume/formatDateRange";
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

function contactLine(resume: ResumeContent, sizes: DocxSizes, font: string, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]): Paragraph {
  const parts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
    resume.contact.linkedin,
  ].filter(Boolean);
  return new Paragraph({
    alignment,
    spacing: { after: 120, line: BODY_LINE },
    children: [new TextRun({ text: parts.join(" | "), font, size: sizes.small, color: "444444" })],
  });
}

function positioningLine(
  resume: ResumeContent,
  sizes: DocxSizes,
  font: string,
  accentHex: string,
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]
): Paragraph | null {
  if (resume.target_titles.length === 0) return null;
  return new Paragraph({
    alignment,
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
  accentHex: string,
  hasRule: boolean
): Paragraph {
  const isMono = headingStyle === "mono_label";
  const isPlainSentence = headingStyle === "plain_sentence_case";
  const displayTitle = isMono
    ? `// ${title.toUpperCase()}`
    : isPlainSentence
    ? title
    : title.toUpperCase();
  const headingFont = isMono ? "Consolas" : font;
  const isGrey = headingStyle === "editorial_grey_unruled" || headingStyle === "executive_grey_unruled";
  const color = isGrey ? "64748B" : accentHex !== "1A1A1A" ? accentHex : "1A1A1A";

  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 90 },
    border: hasRule ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: ruleColor } } : undefined,
    children: [
      new TextRun({
        text: displayTitle,
        font: headingFont,
        size: sizes.heading,
        bold: true,
        color,
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

function labelledRow(text: string, sizes: DocxSizes, font: string, isMono?: boolean): Paragraph {
  const separator = text.indexOf(":");
  const labelFont = isMono ? "Consolas" : font;
  const children =
    separator === -1
      ? [new TextRun({ text, font, size: sizes.body })]
      : [
          new TextRun({ text: text.slice(0, separator + 1), bold: true, font: labelFont, size: sizes.body }),
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
  font: string,
  roleFont: string,
  isSublineLocation: boolean,
  isMonoDate: boolean
): Paragraph[] {
  const dateFont = isMonoDate ? "Consolas" : font;
  const mainRow = new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 90, after: isSublineLocation ? 10 : 20, line: BODY_LINE },
    children: [
      new TextRun({ text: jobTitle, bold: true, font: roleFont, size: sizes.body }),
      new TextRun({ text: " · ", font, size: sizes.body }),
      new TextRun({ text: company, italics: true, font, size: sizes.body }),
      new TextRun({ text: !isSublineLocation && location ? ` ${EM_DASH} ${location}` : "", font, size: sizes.body }),
      new TextRun({ text: `\t${dateRange}`, font: dateFont, size: sizes.body }),
    ],
  });

  if (isSublineLocation && location) {
    const locRow = new Paragraph({
      spacing: { after: 20, line: BODY_LINE },
      children: [new TextRun({ text: location, italics: true, font, size: sizes.small, color: "555555" })],
    });
    return [mainRow, locRow];
  }

  return [mainRow];
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
  template: Template = "clean",
  customAccentColor?: string | null
): Promise<Buffer> {
  const definition = getTemplateDefinition(template);
  const font = definition.tokens.docxFont;
  const activeAccent = customAccentColor ?? definition.tokens.accentColor;
  const accentHex = activeAccent ? activeAccent.replace("#", "") : "1A1A1A";
  const hasSectionRule = definition.tokens.ruleStyle === "full" || definition.tokens.ruleStyle === "hairline" || definition.tokens.ruleStyle === "mono";
  const ruleColor =
    definition.tokens.ruleStyle === "mono"
      ? "475569"
      : definition.tokens.ruleStyle === "hairline"
      ? "CBD5E1"
      : "1A1A1A";

  const isCenterHeader = definition.tokens.headerAlignment === "center";
  const headerAlignment = isCenterHeader ? AlignmentType.CENTER : AlignmentType.LEFT;
  const isIsoDates = definition.tokens.dateFormat === "iso_mono";
  const isSublineLocation = definition.tokens.locationStyle === "subline_italic";
  const isSkillsFirst = definition.tokens.sectionOrder === "skills_first";

  const roleFont = definition.tokens.roleTitleFontFamily
    ? definition.tokens.roleTitleFontFamily.includes("Georgia")
      ? "Georgia"
      : font
    : font;

  const sizes = sizesFor(fontSizePt);
  const children: Paragraph[] = [];

  const nameFont = definition.tokens.nameStyle.fontFamily
    ? definition.tokens.nameStyle.fontFamily.includes("Georgia")
      ? "Georgia"
      : font
    : font;

  const nameColor = definition.tokens.headingStyle === "accent_unruled" ? accentHex : "0F172A";

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: headerAlignment,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: definition.tokens.nameStyle.casing === "uppercase" ? resume.contact.name.toUpperCase() : resume.contact.name,
          font: nameFont,
          size: sizes.name,
          bold: true,
          color: nameColor,
        }),
      ],
    })
  );

  const positioning = positioningLine(resume, sizes, font, accentHex, headerAlignment);
  if (positioning) children.push(positioning);
  children.push(contactLine(resume, sizes, font, headerAlignment));

  const summaryTitle = definition.tokens.sectionTitles?.summary ?? "Professional Summary";
  const experienceTitle = definition.tokens.sectionTitles?.experience ?? "Professional Experience";
  const skillsTitle = definition.tokens.sectionTitles?.skills ?? "Skills & Core Competencies";
  const toolsTitle = definition.tokens.sectionTitles?.tools ?? "Tools & Technologies";
  const projectsTitle = definition.tokens.sectionTitles?.projects ?? "Key Projects";
  const educationTitle = definition.tokens.sectionTitles?.education ?? "Education";

  // Section 1: Summary
  children.push(sectionHeading(summaryTitle, sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule));
  children.push(plainParagraph(resume.summary, sizes, font, { lineHeight: SUMMARY_LINE }));

  const skillsBlock = () => {
    if (resume.skills && resume.skills.length > 0) {
      children.push(sectionHeading(skillsTitle, sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule));
      resume.skills.forEach((skill) => children.push(bulletParagraph(skill, sizes, font)));
    }
  };

  const toolsBlock = () => {
    if (resume.tools && resume.tools.length > 0) {
      children.push(sectionHeading(toolsTitle, sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule));
      resume.tools.forEach((tool) => children.push(labelledRow(tool, sizes, font, definition.tokens.headingStyle === "mono_label")));
    }
  };

  const experienceBlock = () => {
    children.push(sectionHeading(experienceTitle, sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule));
    resume.experience.forEach((job) => {
      const dateRange = isIsoDates
        ? formatIsoDateRange(job.start_date, job.end_date)
        : formatDateRange(job.start_date, job.end_date);

      const headerParagraphs = experienceHeaderRow(
        job.job_title,
        job.company,
        job.location,
        dateRange,
        sizes,
        font,
        roleFont,
        isSublineLocation,
        isIsoDates
      );
      children.push(...headerParagraphs);
      job.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes, font)));
    });
  };

  if (isSkillsFirst) {
    skillsBlock();
    toolsBlock();
    experienceBlock();
  } else {
    experienceBlock();
    skillsBlock();
    toolsBlock();
  }

  if (resume.projects && resume.projects.length > 0) {
    children.push(sectionHeading(projectsTitle, sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule));
    resume.projects.forEach((project) => {
      const left = `${project.title}${project.context ? ` | ${project.context}` : ""}`;
      children.push(headerRow(left, emDashifyRange(project.year), sizes, font));
      project.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes, font)));
    });
  }

  if (resume.education && resume.education.length > 0) {
    children.push(sectionHeading(educationTitle, sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule));
    resume.education.forEach((edu) => {
      children.push(headerRow(`${edu.degree}, ${edu.institution}`, emDashifyRange(edu.year), sizes, font));
      if (edu.notes) children.push(metaLine(edu.notes, sizes, font));
    });
  }

  if (Array.isArray(resume.referees) && resume.referees.length > 0) {
    children.push(sectionHeading("Referees", sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule));
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

