// Mirrors the password rules set in the Supabase dashboard (Authentication > Email): at least 8
// characters with a lowercase letter, an uppercase letter, a digit and a symbol. Supabase is what
// enforces them; this only lets the forms say what's missing in plain words before submitting.
// If the dashboard setting changes, change this file to match.

export const MIN_PASSWORD_LENGTH = 8;
// Supabase's own ceiling (bcrypt only uses the first 72 bytes), not a dashboard setting.
const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_RULES_HINT = `At least ${MIN_PASSWORD_LENGTH} characters, with an uppercase letter, a lowercase letter, a number and a symbol.`;

// Supabase only counts these as symbols (a space or a character like £ doesn't count).
const SYMBOL = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/;

function joinList(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const ACCOUNT_EXISTS_MESSAGE = "An account with this email already exists. Log in instead.";

/** What the password is missing, as one sentence for the form, or null if it meets the rules. */
export function passwordProblem(password: string): string | null {
  // Supabase's auth server measures length in UTF-8 bytes, so count the same way (é is 2).
  const bytes = new TextEncoder().encode(password).length;
  if (bytes > MAX_PASSWORD_BYTES) {
    return `Your password is too long. Please keep it to ${MAX_PASSWORD_BYTES} characters or fewer (accented letters and emoji count as more than one).`;
  }
  const needs: string[] = [];
  if (bytes < MIN_PASSWORD_LENGTH) needs.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
  if (!/[A-Z]/.test(password)) needs.push("an uppercase letter");
  if (!/[a-z]/.test(password)) needs.push("a lowercase letter");
  if (!/[0-9]/.test(password)) needs.push("a number");
  if (!SYMBOL.test(password)) needs.push("a symbol, like ! or #");
  return needs.length ? `Your password needs ${joinList(needs)}.` : null;
}

/**
 * Supabase's weak-password error lists every allowed character; show the plain hint instead.
 * Matched on its error code (stable), falling back to the wording for errors without one. A
 * "pwned" reason (leaked-password protection, if it's on) gets its own message: that password may
 * already meet every rule above.
 */
export function friendlyAuthError(error: { message: string; code?: string; reasons?: string[] }): string {
  if (
    error.code === "user_already_exists" ||
    error.code === "email_exists" ||
    // Older or code-less responses only say it in words.
    /user already registered|email[^.]*already|email exists/i.test(error.message)
  ) {
    return ACCOUNT_EXISTS_MESSAGE;
  }
  if (error.reasons?.includes("pwned")) {
    return "This password has appeared in a data breach on another site, so it isn't safe to use. Please choose a different one.";
  }
  const isWeakPassword = error.code === "weak_password" || /^password should/i.test(error.message.trim());
  return isWeakPassword ? `Your password needs to be stronger. ${PASSWORD_RULES_HINT}` : error.message;
}
