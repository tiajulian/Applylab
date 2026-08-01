import {
  DEFAULT_DENSITY,
  FONT_FLOOR_PT,
  SPACING_FLOOR_SCALE,
  type TemplateDensity,
} from "@/lib/resume/templateDensity";
import type { ResumeContent } from "@/types";

const INITIAL_SUMMARY_WORD_BOUND = Number.POSITIVE_INFINITY;
const TRIMMED_SUMMARY_WORD_BOUND = 45;

// The two most recent roles are never trimmed below this many bullets, regardless of overflow.
const RECENT_ROLE_COUNT = 2;
const RECENT_ROLE_BULLET_FLOOR = 3;
// Older roles trim down to this floor in the main pass (step 3); only the true last-resort step
// (step 6) is allowed to go below it.
const OLDER_ROLE_BULLET_FLOOR = 2;

export interface TrimState {
  density: TemplateDensity;
  summaryWordBound: number;
  /** Bullets dropped from the end of each experience entry, indexed the same as resume.experience. */
  bulletDrop: number[];
}

function cloneState(state: TrimState): TrimState {
  return { density: { ...state.density }, summaryWordBound: state.summaryWordBound, bulletDrop: [...state.bulletDrop] };
}

/**
 * Produces the ordered trim ladder for a resume: state[0] is full density/full content, and each
 * subsequent state is strictly more aggressive, following the fixed priority order (projects
 * section, then referee line, then spacing, then oldest-role bullets, then summary, then font,
 * then a last-resort bullet drop). Pure and side-effect free so it can be tested without a
 * browser. The fit loop in pageFit.ts tries these states in order and stops at the first one that
 * renders to a single page.
 */
export function buildTrimLadder(resume: ResumeContent): TrimState[] {
  const roleCount = resume.experience.length;
  const recentCount = Math.min(RECENT_ROLE_COUNT, roleCount);
  // Oldest-first order among the non-recent roles, since step 3 trims the oldest role first.
  const olderIndicesOldestFirst = resume.experience
    .map((_, index) => index)
    .filter((index) => index >= recentCount)
    .reverse();

  const steps: TrimState[] = [];
  let current: TrimState = {
    density: { ...DEFAULT_DENSITY },
    summaryWordBound: INITIAL_SUMMARY_WORD_BOUND,
    bulletDrop: new Array(roleCount).fill(0),
  };
  steps.push(cloneState(current));

  // 1. Drop the Projects section entirely, if present. It's explicitly optional content, and one
  // dropped section reclaims far more space per step than any single line does, so it goes first.
  if (resume.projects.length > 0) {
    current = { ...current, density: { ...current.density, showProjects: false } };
    steps.push(cloneState(current));
  }

  // 2. Drop the "Referees available on request" line.
  current = { ...current, density: { ...current.density, showRefereeLine: false } };
  steps.push(cloneState(current));

  // 3. Reduce inter-section/inter-bullet spacing, one step then down to the floor.
  for (const spacingScale of [0.85, SPACING_FLOOR_SCALE]) {
    current = { ...current, density: { ...current.density, spacingScale } };
    steps.push(cloneState(current));
  }

  // 4. Drop the last bullet from the oldest role, then next-oldest, one at a time, down to floor.
  let droppedAny = true;
  while (droppedAny) {
    droppedAny = false;
    for (const index of olderIndicesOldestFirst) {
      const total = resume.experience[index].bullets.length;
      const remaining = total - current.bulletDrop[index];
      if (remaining > OLDER_ROLE_BULLET_FLOOR) {
        const bulletDrop = [...current.bulletDrop];
        bulletDrop[index] += 1;
        current = { ...current, bulletDrop };
        steps.push(cloneState(current));
        droppedAny = true;
      }
    }
  }

  // 5. Trim the summary toward its lower word bound.
  current = { ...current, summaryWordBound: TRIMMED_SUMMARY_WORD_BOUND };
  steps.push(cloneState(current));

  // 6. Reduce base font in 0.5pt steps down to the floor.
  for (let fontPt = DEFAULT_DENSITY.fontPt - 0.5; fontPt >= FONT_FLOOR_PT; fontPt -= 0.5) {
    current = { ...current, density: { ...current.density, fontPt } };
    steps.push(cloneState(current));
  }

  // 7. Last resort: drop one more bullet from the second-oldest role (below its step-4 floor).
  // With only one older role, that role is both "oldest" and "second-oldest" for this purpose.
  if (olderIndicesOldestFirst.length > 0) {
    const targetIndex =
      olderIndicesOldestFirst.length >= 2 ? olderIndicesOldestFirst[1] : olderIndicesOldestFirst[0];
    const total = resume.experience[targetIndex].bullets.length;
    const remaining = total - current.bulletDrop[targetIndex];
    if (remaining > 0) {
      const bulletDrop = [...current.bulletDrop];
      bulletDrop[targetIndex] += 1;
      current = { ...current, bulletDrop };
      steps.push(cloneState(current));
    }
  }

  return steps;
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!Number.isFinite(maxWords) || words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

/** Applies a trim state's content-level cuts (summary, bullets) to a resume. Density is a render
 * prop, not a content change, so it's applied separately when rendering the template. */
export function applyTrim(resume: ResumeContent, state: TrimState): ResumeContent {
  return {
    ...resume,
    summary: truncateToWords(resume.summary, state.summaryWordBound),
    experience: resume.experience.map((entry, index) => {
      const drop = state.bulletDrop[index] ?? 0;
      const keep = Math.max(0, entry.bullets.length - drop);
      return { ...entry, bullets: entry.bullets.slice(0, keep) };
    }),
  };
}

// Re-exported so callers that only need the floor constant (e.g. tests) don't need to know it
// lives here rather than in templateDensity.ts.
export { RECENT_ROLE_BULLET_FLOOR, OLDER_ROLE_BULLET_FLOOR };
