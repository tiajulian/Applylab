import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures an active Supabase auth session exists. If no session is found,
 * signs in anonymously passing the Cloudflare Turnstile captcha token to Supabase Auth.
 */
export async function ensureAnonymousSession(
  supabase: SupabaseClient,
  captchaToken: string
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      return { error: null };
    }

    const { error } = await supabase.auth.signInAnonymously({
      options: { captchaToken },
    });

    return { error };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Failed to connect to authentication service") };
  }
}
