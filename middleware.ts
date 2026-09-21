import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isCrossSiteApiMutation } from "@/lib/security/originCheck";
import { checkRedisRateLimit } from "@/lib/rateLimitRedis";
import { getClientIp, ipRateKey } from "@/lib/security/clientIp";

// Coarse per-IP backstop for EVERY /api request, so no route (including future ones) is ever
// unlimited. Generous on purpose (shared office/campus IPs); the tight per-user limits live in
// each route. Redis-only because middleware runs at the edge (no Postgres there), and it fails
// open: a Redis outage must never take the whole API down. Stripe's webhook is skipped
// (signature-verified, and all Stripe traffic shares a few IPs).
const API_IP_MAX = 300;
const API_IP_WINDOW_MS = 60_000;

export async function middleware(request: NextRequest) {
  if (
    isCrossSiteApiMutation({
      method: request.method,
      pathname: request.nextUrl.pathname,
      origin: request.headers.get("origin"),
      requestOrigin: request.nextUrl.origin,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    })
  ) {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  }

  const { pathname } = request.nextUrl;
  const ip = getClientIp(request.headers);
  if (
    ip &&
    pathname.startsWith("/api/") &&
    request.method !== "OPTIONS" &&
    pathname !== "/api/stripe/webhook"
  ) {
    const result = await checkRedisRateLimit(`api-ip:${ipRateKey(ip)}`, API_IP_MAX, API_IP_WINDOW_MS);
    if (result && !result.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|zip|pdf|ico)$).*)",
  ],
};
