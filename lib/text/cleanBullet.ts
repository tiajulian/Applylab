/**
 * Strips any leading bullet characters (such as •, -, *, ◦, ‣, ⁃, etc.) and leading whitespace
 * from bullet point text so that UI components rendering their own bullet symbols do not create
 * duplicate bullets (e.g. "• • ").
 */
export function stripBulletPrefix(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(
      /^[\s•\-\*\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u25A0\u25A1\u2212\u2013\u2014]+\s*/,
      ""
    )
    .trim();
}
