import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";

// TODO: placeholders still to fill in before publishing (see content/legal/terms.md):
//   [LEGAL ENTITY NAME], [ABN], [DATE] (x2, "Effective date" and "Last updated"), [CONTACT EMAIL].
// Once [DATE] becomes a real date, update TERMS_VERSION in lib/terms.ts to match.

export const metadata: Metadata = {
  title: "Terms and Conditions — applylab",
};

// Renders literal `[PLACEHOLDER]` text as an inline code chip so it reads as an obvious TODO on
// the page, without altering the underlying wording in content/legal/terms.md.
function highlightPlaceholders(markdown: string): string {
  return markdown.replace(/\[[A-Z][A-Z /]*\]/g, (match) => `\`${match}\``);
}

export default function TermsPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms.md");
  const markdown = highlightPlaceholders(fs.readFileSync(filePath, "utf-8"));

  return (
    <main className="min-h-screen bg-paper px-4 py-16">
      <article className="mx-auto max-w-2xl">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="font-display text-display text-ink">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-10 font-display text-h2 text-ink">{children}</h2>
            ),
            p: ({ children }) => <p className="mt-4 text-body text-ink-secondary">{children}</p>,
            strong: ({ children }) => (
              <strong className="font-semibold text-ink">{children}</strong>
            ),
            em: ({ children }) => <em className="text-ink-muted">{children}</em>,
            ul: ({ children }) => (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-body text-ink-secondary">
                {children}
              </ul>
            ),
            li: ({ children }) => <li>{children}</li>,
            hr: () => <hr className="my-10 border-border" />,
            code: ({ children }) => (
              <code className="rounded bg-attention-soft px-1.5 py-0.5 font-mono text-sm text-attention">
                {children}
              </code>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </main>
  );
}
