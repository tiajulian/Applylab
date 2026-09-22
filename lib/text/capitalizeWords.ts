/**
 * Capitalizes the first letter of each word in a short label - a job title, company name,
 * location, or status phrase. Deliberately not a full "Title Case" implementation: a word that
 * already carries any uppercase letter (iOS, McDonald's, NSW, IBM) is left untouched entirely,
 * rather than risk mangling it (a blind per-letter capitalize turns "iOS" into "IOS"). Only a
 * fully lowercase word gets its first letter raised.
 *
 * Used on facts copied verbatim from a candidate's profile into a generated resume (job titles,
 * employers, work rights, ...) - see FixedResumeFacts in lib/resume/mergeResumeContent.ts - never
 * on prose (a summary or bullet) where capitalizing every word would be wrong.
 */
export function capitalizeWords(text: string): string {
  return text.replace(/\S+/g, (word) => {
    if (word !== word.toLowerCase()) return word;
    return word.replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  });
}
