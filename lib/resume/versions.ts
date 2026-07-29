import { createClient } from "@/lib/supabase/server";
import type { ResumeContent } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

const MAX_VERSIONS_PER_RESUME = 20;

/**
 * Snapshots a resume's content as a new version, then prunes anything beyond the most
 * recent MAX_VERSIONS_PER_RESUME for that resume. Never throws — catches and logs its own
 * errors — so a version-history hiccup never breaks the generation/duplication/restore it's
 * attached to. Returns whether the snapshot itself was actually saved (pruning failures don't
 * affect this) so call sites that care (the manual "Save version" endpoint) can report a real
 * failure instead of a false "saved!" success — call sites that don't care (auto-snapshot on
 * generation/duplication/restore) can simply ignore the return value.
 */
export async function saveVersionSnapshot(
  supabase: SupabaseServerClient,
  resumeId: string,
  snapshot: ResumeContent,
  label?: string
): Promise<boolean> {
  try {
    const { error: insertError } = await supabase
      .from("resume_versions")
      .insert({ resume_id: resumeId, snapshot, label: label ?? null });

    if (insertError) {
      console.error("saveVersionSnapshot: insert failed", insertError);
      return false;
    }

    try {
      const { data: excess, error: selectError } = await supabase
        .from("resume_versions")
        .select("id")
        .eq("resume_id", resumeId)
        .order("created_at", { ascending: false })
        .range(MAX_VERSIONS_PER_RESUME, MAX_VERSIONS_PER_RESUME + 999);

      if (selectError) {
        console.error("saveVersionSnapshot: failed to check version count", selectError);
      } else if (excess && excess.length > 0) {
        const { error: deleteError } = await supabase
          .from("resume_versions")
          .delete()
          .in("id", excess.map((row) => row.id));

        if (deleteError) {
          console.error("saveVersionSnapshot: failed to prune old versions", deleteError);
        }
      }
    } catch (pruneError) {
      // Pruning is cosmetic — the snapshot itself already succeeded above.
      console.error("saveVersionSnapshot: unexpected pruning error", pruneError);
    }

    return true;
  } catch (error) {
    console.error("saveVersionSnapshot: unexpected error", error);
    return false;
  }
}
