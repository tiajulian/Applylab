import { StorageService, type RecentJobAd } from '../utils/storage';
import type { ScrapedJobDetails } from './jobScraper';

/**
 * Many ATS apply steps (Dayforce's "Manual application", for one) carry no job title at all, so
 * logging from there saved "Job title needed". The ad page the user viewed just before does have
 * it, so its details are remembered here (in this browser only) and reused when the user logs the
 * job from one of that ad's apply steps.
 */

const MAX_REMEMBERED = 30;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Mirrors lib/applications/jobListing.ts on the server: ATS step names that are not a job title,
// and the "| Dayforce Jobs" style tails sites add to page titles.
const PLACEHOLDER_TITLE =
  /^(manual application|application|apply|apply now|job application|application form|submit application|candidate home|careers?|jobs?|job details|job search|search jobs|sign in|log ?in|create account|my applications?)$/i;
const SITE_SUFFIX =
  /\s*(?:\|\s*(?:dayforce|workday|pageup|livehire|seek|linkedin|greenhouse|lever|smartrecruiters|workable|ashby|bamboohr|indeed|jora)\b.*|[-–—]\s*(?:dayforce|workday|pageup|livehire|seek|linkedin|greenhouse|lever|smartrecruiters|workable|ashby|bamboohr|indeed|jora)\s+(?:jobs|careers)\b.*)$/i;
const APPLY_STEP = /\/(?:apply|application|applynow|apply-now)(?:\/[A-Za-z]+)?\/?$/i;

export function isPlaceholderTitle(title: string | undefined): boolean {
  const value = (title ?? '').replace(SITE_SUFFIX, '').trim();
  return !value || PLACEHOLDER_TITLE.test(value);
}

const TRACKING_PARAM = /^(utm_\w+|ref|referrer|gh_src|lever-source|lever-origin|trk|trackingid|fbclid|gclid|mc_\w+)$/i;

/**
 * The ad's identity: host, path without an apply step, and query (some sites tell jobs apart only
 * by ?jobId=), minus tracking parameters and the hash. Null for a site's home page, which isn't
 * one job and would otherwise match every page on the site.
 */
export function jobAdKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(APPLY_STEP, '').replace(/\/$/, '');
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
    }
    parsed.searchParams.sort();
    const query = parsed.searchParams.toString();
    if (!path && !query) return null;
    return `${parsed.host}${path}${query ? `?${query}` : ''}`.toLowerCase();
  } catch {
    return null;
  }
}

async function load(): Promise<RecentJobAd[]> {
  const now = Date.now();
  return ((await StorageService.get('recentJobAds')) ?? []).filter((ad) => now - ad.seenAt < MAX_AGE_MS);
}

/** Remembers this page's job details when it is a job ad with a real title. */
export async function rememberJobAd(job: ScrapedJobDetails, isJobAd: boolean): Promise<void> {
  if (!isJobAd || isPlaceholderTitle(job.jobTitle)) return;
  const key = jobAdKey(window.location.href);
  if (!key) return;
  const ads = (await load()).filter((ad) => ad.key !== key);
  ads.unshift({
    key,
    jobTitle: job.jobTitle.replace(SITE_SUFFIX, '').trim(),
    companyName: job.companyName,
    location: job.location,
    seenAt: Date.now(),
  });
  await StorageService.set('recentJobAds', ads.slice(0, MAX_REMEMBERED));
}

/**
 * The remembered ad this page belongs to: the same ad, or the ad whose path this apply page sits
 * under (".../jobs/123" for ".../jobs/123/apply/manualApplication"). Most recent first. An ad with
 * a query only matches exactly, since a deeper path can't be told apart from a different job.
 */
export async function findRememberedJobAd(url: string): Promise<RecentJobAd | undefined> {
  const key = jobAdKey(url);
  if (!key) return undefined;
  return (await load()).find((ad) => key === ad.key || (!ad.key.includes('?') && key.startsWith(`${ad.key}/`)));
}
