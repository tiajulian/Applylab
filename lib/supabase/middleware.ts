import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TERMS_VERSION } from "@/lib/terms";

// "/resume/" (not "/resume") is deliberate: a bare "/resume" prefix also matches the public,
// no-login-required "/resume-score" marketing page via startsWith, forcing anonymous visitors
// into a login redirect on the one tool explicitly advertised as not requiring an account.
const PROTECTED_PREFIXES = ["/dashboard", "/documents", "/resume/", "/profile", "/applications", "/interview"];

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

  // Hand the already-validated user down to the RSC tree via request headers so
  // getCurrentUser() doesn't have to make its own auth.getUser() round-trip on every
  // page render - that was doubling the auth network cost of every protected request.
  // Headers.set() replaces any client-supplied value outright, so this can't be spoofed.
  const metadata = user?.user_metadata ?? {};
  const avatarUrl =
    (metadata.avatar_url as string | undefined) || (metadata.picture as string | undefined) || "";
  request.headers.set("x-al-uid", user?.id ?? "");
  request.headers.set("x-al-email", user?.email ?? "");
  request.headers.set("x-al-anon", user?.is_anonymous ? "1" : "0");
  request.headers.set("x-al-avatar", encodeURIComponent(avatarUrl));

  const staleCookies = supabaseResponse.cookies.getAll();
  supabaseResponse = NextResponse.next({ request });
  staleCookies.forEach((cookie) => supabaseResponse.cookies.set(cookie));

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAnonymous = Boolean(user?.is_anonymous);

  // Unauthenticated visitors trying to access protected routes
  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Anonymous users are only allowed on /onboarding and /resume/new (where the signup commitment happens)
  if (user && isAnonymous && isProtected) {
    if (pathname !== "/resume/new") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/onboarding";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Permanent users: enforce terms acceptance and onboarding completion
  if (user && !isAnonymous && isProtected) {
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
