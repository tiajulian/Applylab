/** Shared questions for the editor, score findings and guided review cards. */
export const guideQuestions = {
  output: "What did you build?",
  scope: "Which parts did you own?",
  evidence: "What did you do that shows this?",
  action: "What did you do?",
  metric: "Do you have a number for this?",
  wording: "What work or result do you mean?",
  confirm: "Is this correct?",
} as const;

export function phraseQuestion(phrase: string): string {
  if (/\b(solutions?|deliverables?)\b/i.test(phrase)) return guideQuestions.output;
  if (/end[- ]to[- ]end|cross[- ]functional|stakeholder management/i.test(phrase)) return guideQuestions.scope;
  if (/team player|hard.?work|results[- ]|self[- ]|go[- ]getter|synergy|motivated|track record|communication|detail[- ]|dynamic individual|outside the box/i.test(phrase)) return guideQuestions.evidence;
  return guideQuestions.wording;
}
