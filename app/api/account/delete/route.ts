import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { stripe } from "@/lib/stripe/client";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

export const maxDuration = 30;

/**
 * Deletes the CALLING user's own account — requireUser() derives the target solely from the
 * authenticated session, so there is no user-supplied id and no way to delete someone else's
 * account through this route. Uses the service-role client because deleting the auth.users row
 * (which cascades to every public table via `on delete cascade`) and removing storage objects
 * both require privileges the user's own RLS-scoped session doesn't have.
 *
 * Idempotent: re-invoking after a successful delete fails at requireUser() (the session's user
 * no longer exists), and the Stripe/storage cleanup steps are safe to retry if an earlier
 * attempt got partway through.
 */
export async function POST() {
  try {
    const { authUserId, appUser } = await requireUser();
    const serviceClient = createServiceRoleClient();

    const { data: files } = await serviceClient.storage.from("resumes").list(authUserId);
    if (files && files.length > 0) {
      const { error: removeError } = await serviceClient.storage
        .from("resumes")
        .remove(files.map((file) => `${authUserId}/${file.name}`));
      if (removeError) {
        console.error("failed to remove storage objects during account deletion", removeError);
      }
    }

    if (appUser.stripe_customer_id) {
      try {
        await stripe.customers.del(appUser.stripe_customer_id);
      } catch (error) {
        // Already deleted (retry) or another non-fatal Stripe issue — don't block account
        // deletion on billing cleanup the user can't do anything about anyway.
        console.error("failed to delete stripe customer during account deletion", error);
      }
    }

    // Cascades to users, user_profiles, resumes, resume_versions, and applications via the FK
    // `on delete cascade` chain defined in supabase/schema.sql.
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(authUserId);
    if (deleteUserError) {
      throw new Error(deleteUserError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("delete-account error", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
