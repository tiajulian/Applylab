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
import { parseBulletMarkup } from "@/lib/resume/bulletMarkup";
import { DEFAULT_DENSITY, SUMMARY_LINE_HEIGHT } from "@/lib/resume/templateDensity";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import {
  DEFAULT_DESIGN_PREFS,
  fontChoiceById,
  lineHeightCeilingFor,
  marginMmFor,
  spacingStartScaleFor,
  type ResumeDesignPrefs,
} from "@/lib/resume/designPrefs";
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

/** The per-render layout numbers the Design & Font panel's presets (lib/resume/designPrefs.ts)
 * control - computed once in generateResumeDocx and threaded through every paragraph builder
 * below, replacing what used to be module-level constants, so every "after"/"before" spacing value
 * and the body line-height scale the same way the canvas/PDF's own spacingScale/lineHeightFor
 * already do (see templateDensity.ts). scale(n) is the one place that rounds a base spacing value
 * by the resume's spacingScale - every call site below uses it instead of a bare number, so a
 * "compact"/"spacious" pick actually reaches every paragraph, not just some. */
interface DocxLayout {
  bodyLine: number;
  summaryLine: number;
  spacingScale: number;
  scale: (n: number) => number;
}

function layoutFor(designPrefs: ResumeDesignPrefs): DocxLayout {
  const spacingScale = spacingStartScaleFor(designPrefs);
  // docx line spacing is in twentieths of a point with lineRule "auto" (240 = 1.0x).
  const bodyLine = Math.round(lineHeightCeilingFor(designPrefs) * 240);
  // Summary line-height is fixed (mirrors SUMMARY_LINE_HEIGHT's own "independent of the spacing
  // lever" contract in templateDensity.ts) - the line-height preset only ever moves body/bullets.
  const summaryLine = Math.round(SUMMARY_LINE_HEIGHT * 240);
  return { bodyLine, summaryLine, spacingScale, scale: (n) => Math.round(n * spacingScale) };
}

// 1mm in twentieths-of-a-point (twips): 1440 twips/inch / 25.4mm/inch.
const TWIPS_PER_MM = 1440 / 25.4;

function contactLine(resume: ResumeContent, sizes: DocxSizes, font: string, layout: DocxLayout, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]): Paragraph {
  const parts = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.work_rights,
    resume.contact.linkedin,
  ].filter(Boolean);
  return new Paragraph({
    alignment,
    spacing: { after: layout.scale(120), line: layout.bodyLine },
    children: [new TextRun({ text: parts.join(" | "), font, size: sizes.small, color: "444444" })],
  });
}

function positioningLine(
  resume: ResumeContent,
  sizes: DocxSizes,
  font: string,
  accentHex: string,
  layout: DocxLayout,
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]
): Paragraph | null {
  if (resume.target_titles.length === 0) return null;
  return new Paragraph({
    alignment,
    spacing: { after: layout.scale(30), line: layout.bodyLine },
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
  hasRule: boolean,
  layout: DocxLayout
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
    spacing: { before: layout.scale(120), after: layout.scale(90) },
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

/** One TextRun per bold/italic/plain run (see lib/resume/bulletMarkup.ts) - a skill/tool string
 * with no markers parses to a single unmarked run, identical output to a plain TextRun. */
function bulletParagraph(text: string, sizes: DocxSizes, font: string, layout: DocxLayout): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: layout.scale(30), line: layout.bodyLine },
    children: parseBulletMarkup(text).map(
      (run) => new TextRun({ text: run.text, font, size: sizes.body, bold: run.bold || undefined, italics: run.italic || undefined })
    ),
  });
}

function labelledRow(text: string, sizes: DocxSizes, font: string, layout: DocxLayout, isMono?: boolean): Paragraph {
  const separator = text.indexOf(":");
  const labelFont = isMono ? "Consolas" : font;
  const children =
    separator === -1
      ? [new TextRun({ text, font, size: sizes.body })]
      : [
          new TextRun({ text: text.slice(0, separator + 1), bold: true, font: labelFont, size: sizes.body }),
          new TextRun({ text: text.slice(separator + 1), font, size: sizes.body }),
        ];
  return new Paragraph({ spacing: { after: layout.scale(45), line: layout.bodyLine }, children });
}

function headerRow(left: string, right: string, sizes: DocxSizes, font: string, layout: DocxLayout): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: layout.scale(90), after: layout.scale(20), line: layout.bodyLine },
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
  isMonoDate: boolean,
  layout: DocxLayout
): Paragraph[] {
  const dateFont = isMonoDate ? "Consolas" : font;
  const mainRow = new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: layout.scale(90), after: layout.scale(isSublineLocation ? 10 : 20), line: layout.bodyLine },
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
      spacing: { after: layout.scale(20), line: layout.bodyLine },
      children: [new TextRun({ text: location, italics: true, font, size: sizes.small, color: "555555" })],
    });
    return [mainRow, locRow];
  }

  return [mainRow];
}

function metaLine(text: string, sizes: DocxSizes, font: string, layout: DocxLayout): Paragraph {
  return new Paragraph({
    spacing: { after: layout.scale(60), line: layout.bodyLine },
    children: [new TextRun({ text, italics: true, font, size: sizes.small, color: "444444" })],
  });
}

function plainParagraph(
  text: string,
  sizes: DocxSizes,
  font: string,
  layout: DocxLayout,
  options: { bold?: boolean; size?: number; lineHeight?: number } = {}
): Paragraph {
  return new Paragraph({
    spacing: { after: layout.scale(60), line: options.lineHeight ?? layout.bodyLine },
    children: [
      new TextRun({ text, bold: options.bold, font, size: options.size ?? sizes.body }),
    ],
  });
}

export async function generateResumeDocx(
  resume: ResumeContent,
  fontSizePt: number = DEFAULT_DENSITY.fontPt,
  template: Template = "clean",
  customAccentColor?: string | null,
  designPrefs: ResumeDesignPrefs = DEFAULT_DESIGN_PREFS
): Promise<Buffer> {
  const definition = getTemplateDefinition(template);
  const fontOverride = fontChoiceById(designPrefs.fontChoice);
  const font = fontOverride?.docxFont ?? definition.tokens.docxFont;
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
  const layout = layoutFor(designPrefs);
  const marginTwips = Math.round(marginMmFor(designPrefs) * TWIPS_PER_MM);

  // A font override replaces the body font everywhere, but not a template's deliberate heading/
  // role/name accent fonts (e.g. Editorial's Georgia role titles, "mono_label"'s Consolas
  // headings) - same scope the canvas/PDF side keeps (see BaseResumeTemplate.tsx), so choosing
  // "Georgia" from the panel doesn't flatten a template's own distinct display typography.
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
      spacing: { after: layout.scale(60) },
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

  const positioning = positioningLine(resume, sizes, font, accentHex, layout, headerAlignment);
  if (positioning) children.push(positioning);
  children.push(contactLine(resume, sizes, font, layout, headerAlignment));

  const summaryTitle = definition.tokens.sectionTitles?.summary ?? "Professional Summary";
  const experienceTitle = definition.tokens.sectionTitles?.experience ?? "Professional Experience";
  const skillsTitle = definition.tokens.sectionTitles?.skills ?? "Skills & Core Competencies";
  const toolsTitle = definition.tokens.sectionTitles?.tools ?? "Tools & Technologies";
  const projectsTitle = definition.tokens.sectionTitles?.projects ?? "Key Projects";
  const educationTitle = definition.tokens.sectionTitles?.education ?? "Education";

  const heading = (title: string) => sectionHeading(title, sizes, font, ruleColor, definition.tokens.headingStyle, accentHex, hasSectionRule, layout);

  // Section 1: Summary
  children.push(heading(summaryTitle));
  children.push(plainParagraph(resume.summary, sizes, font, layout, { lineHeight: layout.summaryLine }));

  const skillsBlock = () => {
    if (resume.skills && resume.skills.length > 0) {
      children.push(heading(skillsTitle));
      resume.skills.forEach((skill) => children.push(bulletParagraph(skill, sizes, font, layout)));
    }
  };

  const toolsBlock = () => {
    if (resume.tools && resume.tools.length > 0) {
      children.push(heading(toolsTitle));
      resume.tools.forEach((tool) => children.push(labelledRow(tool, sizes, font, layout, definition.tokens.headingStyle === "mono_label")));
    }
  };

  const experienceBlock = () => {
    children.push(heading(experienceTitle));
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
        isIsoDates,
        layout
      );
      children.push(...headerParagraphs);
      job.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes, font, layout)));
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
    children.push(heading(projectsTitle));
    resume.projects.forEach((project) => {
      const left = `${project.title}${project.context ? ` | ${project.context}` : ""}`;
      children.push(headerRow(left, emDashifyRange(project.year), sizes, font, layout));
      project.bullets.forEach((bullet) => children.push(bulletParagraph(bullet, sizes, font, layout)));
    });
  }

  if (resume.education && resume.education.length > 0) {
    children.push(heading(educationTitle));
    resume.education.forEach((edu) => {
      children.push(headerRow(`${edu.degree}, ${edu.institution}`, emDashifyRange(edu.year), sizes, font, layout));
      if (edu.notes) children.push(metaLine(edu.notes, sizes, font, layout));
    });
  }

  if (Array.isArray(resume.referees) && resume.referees.length > 0) {
    children.push(heading("Referees"));
    resume.referees.forEach((referee) => {
      if (typeof referee === "string") {
        children.push(plainParagraph(referee, sizes, font, layout));
      } else if (referee && typeof referee === "object") {
        children.push(plainParagraph(referee.name, sizes, font, layout, { bold: true }));
        const details = [referee.title, referee.organisation].filter(Boolean).join(", ");
        if (details) children.push(metaLine(details, sizes, font, layout));
        if (referee.phone) children.push(metaLine(referee.phone, sizes, font, layout));
        if (referee.email) children.push(metaLine(referee.email, sizes, font, layout));
      }
    });
  } else if (typeof resume.referees === "string" && resume.referees) {
    children.push(
      new Paragraph({
        spacing: { before: layout.scale(120), line: layout.bodyLine },
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
        properties: {
          page: {
            margin: { top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
