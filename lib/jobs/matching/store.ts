import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate } from "@/lib/jobs/matching/score";

const ACTIVE_PROFILE_DAYS = 30;

export interface MatchProfile {
  userId: string | null;
  targetTitles: string[];
  skills: string[];
  locations: string[];
  remoteOk: boolean;
  minSalary: number | null;
  contractTypes: string[];
  /** pgvector literal ("[0.1,0.2,...]"), passed straight back to Postgres. */
  embedding: string;
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
  replaceMatches(userId: string, matches: { job_id: string; score: number; reasons: string[] }[]): Promise<void>;
  /** Profiles saved in the last 30 days that have an embedding. */
  getActiveProfiles(): Promise<(MatchProfile & { userId: string })[]>;
}

interface ProfileRow {
  user_id: string;
  target_titles: string[];
  skills: string[];
  locations: string[];
  remote_ok: boolean;
  min_salary: number | null;
  contract_types: string[];
  embedding: string;
}

export function createSupabaseMatchStore(supabase: SupabaseClient): MatchStore {
  return {
    async getCandidates(profile, limit) {
      const { data, error } = await supabase.rpc("adzuna_match_candidates", {
        p_embedding: profile.embedding,
        p_locations: profile.locations,
        p_remote_ok: profile.remoteOk,
        p_min_salary: profile.minSalary,
        p_contract_types: profile.contractTypes,
        p_user_id: profile.userId,
        p_limit: limit,
      });
      if (error) throw new Error(`adzuna_match_candidates failed: ${error.message}`);
      return data as MatchCandidate[];
    },

    async replaceMatches(userId, matches) {
      const { error } = await supabase.rpc("job_matches_replace", { p_user_id: userId, p_rows: matches });
      if (error) throw new Error(`job_matches_replace failed: ${error.message}`);
    },

    async getActiveProfiles() {
      const since = new Date(Date.now() - ACTIVE_PROFILE_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("job_profiles")
        .select("user_id, target_titles, skills, locations, remote_ok, min_salary, contract_types, embedding")
        .gte("updated_at", since)
        .not("embedding", "is", null);
      if (error) throw new Error(`getActiveProfiles failed: ${error.message}`);
      return ((data ?? []) as ProfileRow[]).map((row) => ({
        userId: row.user_id,
        targetTitles: row.target_titles,
        skills: row.skills,
        locations: row.locations,
        remoteOk: row.remote_ok,
        minSalary: row.min_salary,
        contractTypes: row.contract_types,
        embedding: row.embedding,
      }));
    },
  };
}
