/**
 * Delivery metrics calculations and pacing evaluation for spoken interview answers.
 * Calculations are strictly deterministic to ensure fair, reproducible feedback.
 */

export const OPTIMAL_WPM_MIN = 125;
export const OPTIMAL_WPM_MAX = 165;
export const TARGET_DURATION_SEC = 120; // 2 minutes soft target

/**
 * Calculates words per minute (WPM) from transcript text and measured recording duration in seconds.
 * Returns 0 if duration is negligible (< 1s) or transcript is empty.
 */
export function calculateWpm(transcript: string, durationSec: number): number {
  if (!transcript || !durationSec || durationSec < 1) {
    return 0;
  }

  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 0;
  }

  const wpm = (words.length / durationSec) * 60;
  return Math.round(wpm);
}

export type PacingRating = "too_slow" | "good" | "too_fast";

export interface PacingEvaluation {
  rating: PacingRating;
  feedback: string;
}

/**
 * Calibrated pacing evaluation tailored to corporate and tech interviews.
 * Standard conversational speaking rate is ~130-160 WPM.
 */
export function evaluatePacing(wpm: number): PacingEvaluation {
  if (wpm === 0) {
    return {
      rating: "good",
      feedback: "Answer was submitted via text or had no measurable audio duration.",
    };
  }

  if (wpm < OPTIMAL_WPM_MIN) {
    return {
      rating: "too_slow",
      feedback: `Pacing was somewhat slow (${wpm} WPM). Aim for ${OPTIMAL_WPM_MIN}–${OPTIMAL_WPM_MAX} WPM to maintain interviewer momentum while staying articulate.`,
    };
  }

  if (wpm > OPTIMAL_WPM_MAX) {
    return {
      rating: "too_fast",
      feedback: `Pacing was fast (${wpm} WPM). Interviewers may struggle to note your key points. Try pausing between thoughts and aiming for ~${OPTIMAL_WPM_MIN}–${OPTIMAL_WPM_MAX} WPM.`,
    };
  }

  return {
    rating: "good",
    feedback: `Solid, articulate pacing (${wpm} WPM). Well within the optimal interview range (${OPTIMAL_WPM_MIN}–${OPTIMAL_WPM_MAX} WPM).`,
  };
}

export interface DurationEvaluation {
  isOverLimit: boolean;
  feedback: string;
}

/**
 * Checks if answer length exceeds recommended limits (~2 minutes for a behavioural answer).
 */
export function evaluateDuration(durationSec: number): DurationEvaluation {
  if (!durationSec || durationSec <= 0) {
    return {
      isOverLimit: false,
      feedback: "Length not recorded.",
    };
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.round(durationSec % 60);
  const timeFormatted = `${minutes}m ${seconds}s`;

  if (durationSec > 150) {
    return {
      isOverLimit: true,
      feedback: `Answer ran long (${timeFormatted}). Strong STAR answers typically wrap in 90–120 seconds to prevent interviewer fatigue.`,
    };
  }

  if (durationSec < 30) {
    return {
      isOverLimit: false,
      feedback: `Answer was very brief (${timeFormatted}). Ensure you flesh out the specific Action and quantifiable Result steps.`,
    };
  }

  return {
    isOverLimit: false,
    feedback: `Good duration (${timeFormatted}), staying close to the 2-minute guideline.`,
  };
}
