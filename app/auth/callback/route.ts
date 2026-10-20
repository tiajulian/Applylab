import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/terms";
import { safeNextPath } from "@/lib/url/safeNextPath";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/passwordRecovery";
import { NextResponse } from "next/server";

/** How long a reset email's link is accepted for (Supabase's default OTP expiry). */
const RECOVERY_LINK_MAX_AGE_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Signal set by the signup forms right before starting the Google redirect: clicking
      // past their TermsNotice ("By continuing, you agree...") is the acceptance. Google OAuth doesn't carry
      // custom signup-form metadata through the round trip the way email/password signUp() does,
      // so this cookie is how a brand-new OAuth account gets its acceptance recorded here,
      // immediately after the account is created by the on_auth_user_created trigger.
      const cookieStore = cookies();
      if (cookieStore.get("pending_terms_accept")) {
        await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
        cookieStore.delete("pending_terms_accept");
      }

      // A password-reset link: straight to setting the new password, whatever else is pending.
      // The cookie is what /reset-password checks, so an ordinary session alone can't open it -
      // including an ordinary (e.g. Google) log in sent here via ?next=/reset-password, which is
      // why it also needs a reset email sent recently.
      const recoverySentAt = data.user.recovery_sent_at ? Date.parse(data.user.recovery_sent_at) : NaN;
      const isRecovery = Date.now() - recoverySentAt <= RECOVERY_LINK_MAX_AGE_MS;
      if (next === "/reset-password" && isRecovery) {
        const response = NextResponse.redirect(`${origin}/reset-password`);
        response.cookies.set(PASSWORD_RECOVERY_COOKIE, "1", {
          path: "/reset-password",
          maxAge: 15 * 60,
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        });
        return response;
      }

      const { data: appUser } = await supabase
        .from("users")
        .select("onboarded")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!appUser?.onboarded) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // An expired or already-used reset link gets the reset page's own "ask for a new link" screen.
  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
