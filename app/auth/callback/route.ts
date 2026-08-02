import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/terms";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Signal set by the signup form (app/(auth)/signup/page.tsx) right before starting the
      // Google redirect, once its required terms checkbox was ticked. Google OAuth doesn't carry
      // custom signup-form metadata through the round trip the way email/password signUp() does,
      // so this cookie is how a brand-new OAuth account gets its acceptance recorded here,
      // immediately after the account is created by the on_auth_user_created trigger.
      const cookieStore = cookies();
      if (cookieStore.get("pending_terms_accept")) {
        await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
        cookieStore.delete("pending_terms_accept");
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

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
