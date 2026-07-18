export function CoverLetterPreview({ coverLetter }: { coverLetter: string }) {
  return (
    <article className="mx-auto w-full max-w-[210mm] rounded-lg border border-gray-200 bg-white p-10 text-sm leading-relaxed text-gray-800 shadow-sm">
      {coverLetter.split("\n").map((paragraph, i) =>
        paragraph.trim() ? (
          <p key={i} className="mb-4">
            {paragraph}
          </p>
        ) : null
      )}
    </article>
  );
}
