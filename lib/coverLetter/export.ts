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

/**
 * A download name set in the browser (an <a download>), never a response header, so letters in
 * any language and apostrophes are kept ("José O'Brien"). Only characters that break file names
 * are dropped. The parts are joined with " - "; the last part (e.g. "Resume") is always kept and
 * the earlier ones are shortened instead when the name gets long.
 */
export function browserDownloadName(parts: Array<string | null | undefined>, format: ExportFormat): string {
  const clean = parts
    .map((part) => (part ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const last = clean.pop() ?? "document";
  const lead = clean.join(" - ").slice(0, 100).trim();
  return `${lead ? `${lead} - ` : ""}${last}.${format}`;
}
