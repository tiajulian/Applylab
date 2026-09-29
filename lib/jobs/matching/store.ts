import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate } from "@/lib/jobs/matching/score";
import { resolvePoints } from "@/lib/jobs/places";

const ACTIVE_PROFILE_DAYS = 30;

export interface MatchProfile {
  userId: string | null;
  targetTitles: string[];
  skills: string[];
  /** Jobs within radiusKm of any of these places match (states and unknown places by name). */
  locations: string[];
  /** null = anywhere in Australia. */
  radiusKm: number | null;
  remoteOk: boolean;
  minSalary: number | null;
  contractTypes: string[];
  /** pgvector literal ("[0.1,0.2,...]"), passed straight back to Postgres. */
  embedding: string;
  /** The stored profile version these fields came from; the cache write is skipped if it changed. */
  updatedAt?: string | null;
}

export interface MatchCandidate extends Candidate {
  company: string | null;
  location_display: string;
  category_label: string | null;
  contract_type: string | null;
  contract_time: string | null;
  redirect_url: string;
}

export interface MatchStore {
  getCandidates(profile: MatchProfile, limit: number): Promise<MatchCandidate[]>;
  /** Swaps the user's cached matches. False (nothing written) if the profile changed meanwhile. */
  replaceMatches(
    userId: string,
    matches: { job_id: string; score: number; reasons: string[] }[],
    profileUpdatedAt: string | null
  ): Promise<boolean>;
  /** Profiles saved in the last 30 days that have an embedding. */
  getActiveProfiles(): Promise<(MatchProfile & { userId: string })[]>;
}

interface ProfileRow {
  user_id: string;
  target_titles: string[];
  skills: string[];
  locations: string[];
  search_radius_km: number | null;
  remote_ok: boolean;
  min_salary: number | null;
  contract_types: string[];
  embedding: string;
  updated_at: string;
}

export function createSupabaseMatchStore(supabase: SupabaseClient): MatchStore {
  return {
    async getCandidates(profile, limit) {
      // Resolved per call (one small lookup), so the points always reflect the current place data.
      const { points, unresolved } = await resolvePoints(supabase, profile.locations);
      const { data, error } = await supabase.rpc("adzuna_match_candidates", {
        p_embedding: profile.embedding,
        p_locations: unresolved,
        p_remote_ok: profile.remoteOk,
        p_min_salary: profile.minSalary,
        p_contract_types: profile.contractTypes,
        p_user_id: profile.userId,
        p_limit: limit,
        p_points: points,
        p_radius_km: profile.radiusKm,
      });
      if (error) throw new Error(`adzuna_match_candidates failed: ${error.message}`);
      return data as MatchCandidate[];
    },

    async replaceMatches(userId, matches, profileUpdatedAt) {
      const { data, error } = await supabase.rpc("job_matches_replace", {
        p_user_id: userId,
        p_rows: matches,
        p_profile_updated_at: profileUpdatedAt,
      });
      if (error) throw new Error(`job_matches_replace failed: ${error.message}`);
      return data as boolean;
    },

    async getActiveProfiles() {
      const since = new Date(Date.now() - ACTIVE_PROFILE_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("job_profiles")
        .select("user_id, target_titles, skills, locations, search_radius_km, remote_ok, min_salary, contract_types, embedding, updated_at")
        .gte("updated_at", since)
        .not("embedding", "is", null);
      if (error) throw new Error(`getActiveProfiles failed: ${error.message}`);
      return ((data ?? []) as ProfileRow[]).map((row) => ({
        userId: row.user_id,
        targetTitles: row.target_titles,
        skills: row.skills,
        locations: row.locations,
        radiusKm: row.search_radius_km,
        remoteOk: row.remote_ok,
        minSalary: row.min_salary,
        contractTypes: row.contract_types,
        embedding: row.embedding,
        updatedAt: row.updated_at,
      }));
    },
  };
}
