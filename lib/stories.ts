/**
 * Real quotes from ApplyLab users, shown on the home page (StoriesSection, PricingSection).
 *
 * Only add a story with the person's written permission on file. Use their own words, lightly
 * trimmed; never write or "improve" a quote, and never add names, photos, ratings or counts that
 * weren't given to us. Fake reviews mislead under Australian Consumer Law.
 *
 * Deliberately has NO imports: scripts/verify-landing.mjs imports this file directly under Node's
 * type stripping, which can't resolve the "@/" alias.
 */

export type Story = {
  /** The person's own words, lightly trimmed only, max ~30 words. */
  quote: string;
  /** First name only. */
  firstName: string;
  /** e.g. "Operations Coordinator" */
  role: string;
  /** e.g. "Melbourne" */
  city: string;
  /** Optional, only if they said it, e.g. "Got 3 interviews in 2 weeks". */
  outcome?: string;
  /** Written permission on file. */
  consent: true;
};

/** Founder fills this in. */
export const STORIES: Story[] = [];

/** The stories section needs at least two quotes; one alone reads as cherry-picked. */
export const STORIES_SECTION_MIN = 2;
