// Adzuna Search API response shapes. Every field is optional - Adzuna omits fields freely.

export interface AdzunaJobResult {
  id?: string | number;
  title?: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  latitude?: number;
  longitude?: number;
  category?: { label?: string; tag?: string };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string | number | boolean;
  contract_type?: string;
  contract_time?: string;
  created?: string;
  redirect_url?: string;
}

export interface AdzunaSearchResponse {
  count?: number;
  mean?: number;
  results?: AdzunaJobResult[];
}

export interface AdzunaCategory {
  tag?: string;
  label?: string;
}

export interface AdzunaCategoriesResponse {
  results?: AdzunaCategory[];
}

export interface AdzunaSearchParams {
  page: number;
  what?: string;
  where?: string;
  category?: string;
  maxDaysOld?: number;
  resultsPerPage?: number;
  sortBy?: "date" | "relevance" | "salary";
}
