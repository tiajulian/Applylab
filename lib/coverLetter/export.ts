export type ExportFormat = "pdf" | "docx";

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "pdf" || value === "docx";
}

/** A safe download name from the letter's title: letters, numbers, spaces and dashes only. */
export function exportFilename(title: string, format: ExportFormat): string {
  const base = title
    .replace(/[^A-Za-z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return `${base || "cover-letter"}.${format}`;
}
