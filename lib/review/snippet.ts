export interface Snippet {
  prefix: string;
  match: string;
  suffix: string;
}

/** A short excerpt around [start, end) so a card can show the affected words in context. Trims to
 * whole words and marks a cut with an ellipsis. */
export function contextSnippet(text: string, start: number, end: number, radius = 48): Snippet {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const cutFront = from > 0 ? text.slice(from, start).replace(/^\S*\s/, "") : text.slice(0, start);
  const cutBack = to < text.length ? text.slice(end, to).replace(/\s\S*$/, "") : text.slice(end);
  return {
    prefix: `${from > 0 ? "…" : ""}${cutFront}`,
    match: text.slice(start, end),
    suffix: `${cutBack}${to < text.length ? "…" : ""}`,
  };
}
