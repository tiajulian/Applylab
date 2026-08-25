import { NextResponse } from "next/server";

// The Chrome extension's background service worker calls these routes cross-origin
// with credentials: 'include' (for the Supabase session cookie). Browsers only allow
// that when the response echoes back the exact request Origin (a wildcard '*' is
// rejected once credentials are involved) plus Access-Control-Allow-Credentials.
// Scoped to chrome-extension:// origins only — a normal website origin (https://...)
// never matches this prefix, so this doesn't open these routes up to arbitrary sites.
// The extension is currently unpacked/dev-mode, so its ID varies per install; once
// published to the Chrome Web Store with a fixed ID, this can be narrowed further to
// that exact origin instead of reflecting any chrome-extension:// origin.
const EXTENSION_ORIGIN_PREFIX = "chrome-extension://";

export function extensionCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!origin.startsWith(EXTENSION_ORIGIN_PREFIX)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export function extensionCorsPreflight(request: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders(request) });
}

export function withExtensionCors(response: NextResponse, request: Request): NextResponse {
  const headers = extensionCorsHeaders(request);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
