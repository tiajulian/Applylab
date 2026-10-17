import { Fragment } from "react";
import { clsx } from "@/lib/utils";
import { FILLER_WORDS, repeatedWords, safeSpans } from "@/lib/interview/spans";
import { STAR_PARTS, STAR_PART_LABELS } from "@/lib/interview/scoreLabels";
import type { StarPart, TranscriptSpan } from "@/types";

const PART_STYLES: Record<StarPart, string> = {
  situation: "bg-accent-soft",
  task: "bg-attention-soft",
  action: "bg-success-soft",
  result: "bg-paper-deep",
};

// "like" and "actually" are real words far more often than fillers, so they are never struck.
const STRUCK_FILLERS = new Set(FILLER_WORDS.filter((w) => !w.includes(" ") && w !== "like" && w !== "actually"));
const wordKey = (token: string) => token.toLowerCase().replace(/[^\p{L}']/gu, "");

/** Words of one plain run, with repeated words underlined and fillers struck through. */
function Words({ text, repeated }: { text: string; repeated: Map<string, number> }) {
  return (
    <>
      {text.split(/(\s+)/).map((token, i) => {
        const key = wordKey(token);
        if (!key) return <Fragment key={i}>{token}</Fragment>;
        if (STRUCK_FILLERS.has(key)) {
          return (
            <span key={i} className="text-ink-muted line-through decoration-ink-muted/60">
              {token}
            </span>
          );
        }
        const count = repeated.get(key);
        if (count) {
          return (
            <span
              key={i}
              title={`You said '${key}' ${count} times.`}
              className="underline decoration-attention decoration-wavy underline-offset-4"
            >
              {token}
            </span>
          );
        }
        return <Fragment key={i}>{token}</Fragment>;
      })}
    </>
  );
}

/**
 * The candidate's answer with where each STAR part happened highlighted. Each part is shown by a
 * colour and a letter, so it never relies on colour alone.
 */
export function AnnotatedTranscript({ transcript, spans }: { transcript: string; spans?: TranscriptSpan[] | null }) {
  const ordered = safeSpans(transcript, spans);
  const repeated = new Map(repeatedWords(transcript).map((r) => [r.word, r.count]));
  const covered = new Set(ordered.map((s) => s.part));
  const hasFillers = transcript.split(/\s+/).some((t) => STRUCK_FILLERS.has(wordKey(t)));

  const pieces: { text: string; part?: StarPart }[] = [];
  let cursor = 0;
  for (const s of ordered) {
    if (s.start > cursor) pieces.push({ text: transcript.slice(cursor, s.start) });
    pieces.push({ text: transcript.slice(s.start, s.end), part: s.part });
    cursor = s.end;
  }
  if (cursor < transcript.length) pieces.push({ text: transcript.slice(cursor) });

  return (
    <div className="flex flex-col gap-3">
      {ordered.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Key">
          {STAR_PARTS.map((p) => (
            <li
              key={p}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5",
                PART_STYLES[p],
                !covered.has(p) && "opacity-50"
              )}
            >
              <span className="font-bold">{STAR_PART_LABELS[p][0]}</span>
              {STAR_PART_LABELS[p]}
              {!covered.has(p) && <span className="sr-only">(not found in your answer)</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="whitespace-pre-wrap text-sm leading-7 text-ink">
        {pieces.map((piece, i) =>
          piece.part ? (
            <mark key={i} className={clsx("rounded px-0.5 text-ink", PART_STYLES[piece.part])}>
              <span className="mr-1 rounded bg-surface px-1 text-[10px] font-bold">
                {STAR_PART_LABELS[piece.part][0]}
                <span className="sr-only"> {STAR_PART_LABELS[piece.part]}:</span>
              </span>
              <Words text={piece.text} repeated={repeated} />
            </mark>
          ) : (
            <Words key={i} text={piece.text} repeated={repeated} />
          )
        )}
      </p>
      {(repeated.size > 0 || hasFillers) && (
        <p className="text-xs text-ink-muted">
          {repeated.size > 0 && "Wavy underline: words you used 3 or more times. "}
          {hasFillers && "Struck through: filler words."}
        </p>
      )}
    </div>
  );
}
