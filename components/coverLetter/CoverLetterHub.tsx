import Link from "next/link";

export interface CoverLetterListItem {
  id: string;
  title: string;
  company: string;
  word_count: number;
  updated_at: string;
}

/** Standalone cover letters (written on their own, not alongside a resume). */
export function CoverLetterHub({ letters }: { letters: CoverLetterListItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {letters.map((letter) => (
        <li key={letter.id}>
          <Link
            href={`/cover-letter/${letter.id}`}
            className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-5 shadow-sm transition-[transform,box-shadow] duration-fast ease-editorial hover:-translate-y-0.5 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-[15px] font-semibold text-ink">{letter.title}</span>
            {letter.company && <span className="text-[13.5px] text-ink-secondary">{letter.company}</span>}
            <span className="mt-auto flex items-center gap-2 pt-3 text-[12.5px] text-ink-muted">
              <span>{letter.word_count} words</span>
              <span aria-hidden="true">&middot;</span>
              <span>
                Edited {new Date(letter.updated_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
