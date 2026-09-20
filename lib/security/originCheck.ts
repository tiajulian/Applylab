// CSRF defence for the JSON API: a state-changing request from a browser always carries an
// Origin header, so one whose Origin isn't this app is a cross-site request and is rejected.
// Requests with no Origin (curl, server-to-server, Stripe's webhook) aren't a CSRF vector - CSRF
// needs a victim's browser - so they pass; they still have to authenticate on their own.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const EXTENSION_ORIGIN_PREFIX = "chrome-extension://";
// The routes the Chrome extension calls cross-origin (see lib/extensionCors.ts). Only these may
// be hit from a chrome-extension:// origin.
const EXTENSION_PATHS = [
  /^\/api\/applications$/,
  /^\/api\/copilot\/generate-answer$/,
  /^\/api\/user\/autofill-profile$/,
  /^\/api\/resumes\/[^/]+\/pdf-blob$/,
];

function safeOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** True when the request is a mutating /api call whose Origin isn't this app (or the extension on its routes). */
export function isCrossSiteApiMutation(request: {
  method: string;
  pathname: string;
  origin: string | null;
  requestOrigin: string;
  appUrl?: string;
}): boolean {
  if (!request.pathname.startsWith("/api/")) return false;
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;
  if (!request.origin) return false;

  if (request.origin === request.requestOrigin) return false;
  if (request.origin === safeOrigin(request.appUrl)) return false;
  if (
    request.origin.startsWith(EXTENSION_ORIGIN_PREFIX) &&
    EXTENSION_PATHS.some((pattern) => pattern.test(request.pathname))
  ) {
    return false;
  }
  return true;
}
