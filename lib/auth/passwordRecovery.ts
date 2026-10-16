/**
 * Set by /auth/callback when a password-reset link signs the user in, and required by
 * /reset-password: a session from an ordinary log in isn't enough to set a new password there.
 */
export const PASSWORD_RECOVERY_COOKIE = "pw_recovery";
