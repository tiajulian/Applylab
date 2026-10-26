const BASE = "https://applylab.invalid";

/**
 * The value as an in-app path ("/dashboard?x=1"), or the fallback. Used for post-login redirects
 * (?redirectedFrom=, ?next=), which come from the URL and so can't be trusted. Resolved the way a
 * browser would, so every trick that leaves the site ("//evil.com", "/\evil.com", a tab or newline
 * the URL parser strips, "@evil.com" appended to an origin) falls back instead.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value?.startsWith("/")) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    const path = url.pathname + url.search + url.hash;
    // "/.//evil.com" normalises to "//evil.com", which a browser follows off-site (protocol-relative).
    return path.startsWith("//") ? fallback : path;
  } catch {
    return fallback;
  }
}
