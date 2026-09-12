import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { toMarketingUser } from "@/components/marketing/toMarketingUser";

export const dynamic = "force-dynamic";

/**
 * Thin wrapper around getCurrentUser(), fetched client-side by useMarketingUser() so marketing
 * pages (home, pricing, privacy, blog, resume-score) don't have to call getCurrentUser() - and
 * therefore headers() - in their own Server Components. Any use of headers()/cookies() forces
 * Next to render the whole page dynamically per-request instead of serving a static/cached copy,
 * which was the biggest single contributor to this site's slow LCP: every marketing-page visit
 * (the overwhelming majority logged-out) paid for a live auth check just to decide whether the
 * header shows "Log in" or an avatar menu. Moving that one check into this endpoint lets the rest
 * of the page go back to being static.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: toMarketingUser(user) });
}
