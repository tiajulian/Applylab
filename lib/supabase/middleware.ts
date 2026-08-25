import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TERMS_VERSION } from "@/lib/terms";

const PROTECTED_PREFIXES = ["/dashboard", "/resume", "/profile", "/applications", "/interview"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isProtected) {
    const { data: appUser } = await supabase
      .from("users")
      .select("onboarded, accepted_terms_at, accepted_terms_version")
      .eq("id", user.id)
      .maybeSingle();

    // Checked first, ahead of onboarding: an outdated/missing acceptance blocks the whole app,
    // not just first-time setup. Existing users (accepted_terms_at null on this column's
    // rollout) hit this on their next visit to a protected route and are sent here once.
    if (appUser && (!appUser.accepted_terms_at || appUser.accepted_terms_version !== TERMS_VERSION)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/accept-terms";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (appUser && !appUser.onboarded) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/onboarding";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
