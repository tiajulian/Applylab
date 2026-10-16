/** Longest job link we store; a longer one is dropped rather than cut (a cut URL is a broken one). */
export const MAX_JOB_URL_LENGTH = 2000;

/**
 * The input as an http(s) link, or null. Links are rendered as clickable hrefs, so anything else
 * (javascript:, data:, mailto:, junk) is refused. A link typed without a scheme
 * ("seek.com.au/job/1", "www.seek.com.au:443/job/1") gets https:// added. A valid link is returned
 * exactly as given otherwise - never re-encoded, since job boards' tracking links (Adzuna's
 * redirect_url) must stay byte-for-byte intact.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_JOB_URL_LENGTH) return null;
  // "name:" not followed by a digit is a scheme (javascript:, mailto:, https:); "host:443" is a port.
  const scheme = /^([a-z][a-z\d+.-]*):(?!\d)/i.exec(trimmed)?.[1].toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") return null;
  // "https:seek.com.au" parses, but as an href the browser treats it as a path on this site.
  if (scheme && !/^[a-z]+:\/\//i.test(trimmed)) return null;
  const candidate = scheme ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    // A bare word ("hello", "localhost") parses as a host but isn't a link anyone can open.
    return url.hostname.includes(".") ? candidate : null;
  } catch {
    return null;
  }
}

export const INVALID_JOB_URL_MESSAGE = "That job link doesn't look right. Check it starts with a website address.";

/**
 * A request's job_url field: a safe link, null (blank, missing, or too long to keep - the rest of
 * the application still saves), or an error for text that isn't a link at all.
 */
export function parseJobUrlField(value: unknown): { url: string | null } | { error: string } {
  const url = safeHttpUrl(value);
  if (url !== null || typeof value !== "string") return { url };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_JOB_URL_LENGTH) return { url: null };
  return { error: INVALID_JOB_URL_MESSAGE };
}
