import { Document, Packer, Paragraph, TextRun } from "docx";
import { buildCoverLetterHeader, buildCoverLetterRecipient } from "@/lib/text/coverLetterHeader";
import type { ResumeContact } from "@/types";

const FONT = "Arial";
// Sizes mirror lib/export/resumeDocx.ts (docx sizes are half-points, so pt * 2).
const NAME_SIZE = 30; // 15pt
const SMALL_SIZE = 19; // 9.5pt
const INK = "1A1A1A";
const MUTED = "444444";

export async function generateCoverLetterDocx(coverLetter: string, contact: ResumeContact, companyName?: string | null): Promise<Buffer> {
  const header = buildCoverLetterHeader(contact);
  const recipient = buildCoverLetterRecipient(coverLetter, companyName);

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: header.name, bold: true, font: FONT, size: NAME_SIZE, color: INK })],
    }),
  ];
  if (header.contactLine) {
    headerParagraphs.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: header.contactLine, font: FONT, size: SMALL_SIZE, color: MUTED })],
      })
    );
  }
  headerParagraphs.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun({ text: header.date, font: FONT, size: SMALL_SIZE, color: MUTED })],
    })
  );

  // The address block: tight lines, then a gap before the greeting.
  const recipientParagraphs = recipient.map(
    (line, i) =>
      new Paragraph({
        spacing: { after: i === recipient.length - 1 ? 240 : 0 },
        children: [new TextRun({ text: line, font: FONT, size: 22, color: INK })],
      })
  );

  const bodyParagraphs = coverLetter
    .split("\n")
    .filter((line) => line.trim())
    .map(
      (line) =>
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: line, font: FONT, size: 22 })],
        })
    );

  const document = new Document({
    sections: [
      {
        properties: {},
        children: [...headerParagraphs, ...recipientParagraphs, ...bodyParagraphs],
      },
    ],
  });

  return Packer.toBuffer(document);
}
