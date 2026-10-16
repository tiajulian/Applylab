import { createServiceRoleClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/jobs/api";
import { safeHttpUrl } from "@/lib/url/safeHttpUrl";

/** A Find jobs listing, as the New resume page needs it ("Tailor resume & apply"). */
export interface ListingForResume {
  title: string;
  company: string;
  location: string;
  /** Adzuna's redirect_url, kept exactly (their terms require its tracking parameters). */
  url: string;
}

/**
 * Looks up a listing by id for /resume/new?job=<id>. Listings are public data shared by every
 * user, so this reads with the service role; only display fields leave the server. Null for a bad
 * id, a listing that no longer exists or is no longer listed, or one without a usable link.
 */
export async function getListingForResume(id: string | undefined): Promise<ListingForResume | null> {
  if (!id || !isUuid(id)) return null;
  const { data } = await createServiceRoleClient()
    .from("adzuna_jobs")
    .select("title, company, location_display, redirect_url, is_active")
    .eq("id", id)
    .maybeSingle();
  const url = safeHttpUrl(data?.redirect_url);
  if (!data || !data.is_active || !url) return null;
  return { title: data.title ?? "", company: data.company ?? "", location: data.location_display ?? "", url };
}
