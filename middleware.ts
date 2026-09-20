import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isCrossSiteApiMutation } from "@/lib/security/originCheck";

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
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|zip|pdf|ico)$).*)",
  ],
};
