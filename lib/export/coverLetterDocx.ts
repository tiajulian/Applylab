import { Document, Packer, Paragraph, TextRun } from "docx";

const FONT = "Arial";

export async function generateCoverLetterDocx(coverLetter: string): Promise<Buffer> {
  const paragraphs = coverLetter
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
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(document);
}
