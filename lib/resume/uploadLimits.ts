/** Resume-upload limits, kept free of server-only imports so client upload UIs can share them with
 * the server's reader (lib/resume/extractText.ts) and never drift from it. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const RESUME_FILE_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
