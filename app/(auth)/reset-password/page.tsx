import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/passwordRecovery";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset password" };

/**
 * Where a password-reset email lands, via /auth/callback (which swaps the link's code for a
 * session and sets the recovery cookie). Without both - link expired, used already, opened in
 * another browser, or just a normal logged-in visit - it offers a new link instead of the form.
 * A guest (anonymous) session has no password to reset.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  const canReset = Boolean(user && !user.isAnonymous && (await cookies()).get(PASSWORD_RECOVERY_COOKIE));
  return <ResetPasswordForm canReset={canReset} />;
}
