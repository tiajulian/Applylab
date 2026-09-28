// Shared by client.ts, server.ts, and middleware.ts so the three Supabase client constructors
// can't drift apart on cookie attributes. secure (HTTPS only, and browsers special-case
// localhost as a secure context so local dev still works) and sameSite=lax (not "strict" - the
// Google OAuth redirect back from the provider is a top-level cross-site navigation that
// "strict" would drop the session cookie on). @supabase/ssr's own defaults never set `secure`
// at all, so this closes a real gap, not just a belt-and-suspenders one.
export const cookieOptions = { secure: true, sameSite: "lax" as const };
