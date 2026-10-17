"use server";

import { cookies } from "next/headers";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/passwordRecovery";

/** Closes the reset window once it's used (or skipped), so the form can't be reopened afterwards. */
export async function endPasswordRecovery() {
  cookies().delete({ name: PASSWORD_RECOVERY_COOKIE, path: "/reset-password" });
}
