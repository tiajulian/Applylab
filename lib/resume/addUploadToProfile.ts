import type { createClient } from "@/lib/supabase/server";
import { computeCompleteness, toScorableProfile } from "@/lib/profile/completeness";
import { profileAdditionsFrom } from "@/lib/resume/importedProfile";
import type { UserProfile } from "@/types";

/**
 * After an upload is used (a resume built from it, or a job-ad fit check run against it), the
 * saved profile takes whatever the file adds (see profileAdditionsFrom: nothing saved is changed),
 * so the user can tailor from it later, and the fit check's role picker and the editor's fact
 * re-checks, which read the saved profile, find everything the file holds. Also keeps users in
 * step the way /api/profile does: the completeness score, and the name when the account has none.
 * Best-effort: the caller's work is already done, so failures are only logged.
 */
export async function addUploadToProfile(
  supabase: ReturnType<typeof createClient>,
  appUser: { id: string; full_name: string | null },
  stored: UserProfile | null,
  imported: { profile: UserProfile; fullName: string }
) {
  try {
    const additions = profileAdditionsFrom(imported.profile, stored);
    const nameToSet = !appUser.full_name?.trim() && imported.fullName ? imported.fullName : null;
    if (!additions && !nameToSet) return;

    if (additions) {
      const { error } = await supabase
        .from("user_profiles")
        .upsert({ user_id: appUser.id, ...additions, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) {
        console.error("addUploadToProfile: failed to add upload to profile", error);
        return;
      }
    }

    const merged = { ...stored, ...additions };
    const userUpdate: Record<string, unknown> = {
      profile_completeness: computeCompleteness(toScorableProfile(merged, nameToSet ?? appUser.full_name)),
    };
    if (nameToSet) userUpdate.full_name = nameToSet;
    const { error } = await supabase.from("users").update(userUpdate).eq("id", appUser.id);
    if (error) console.error("addUploadToProfile: failed to update user after upload", error);
  } catch (error) {
    console.error("addUploadToProfile: failed to add upload to profile", error);
  }
}
