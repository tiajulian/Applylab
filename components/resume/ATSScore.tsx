function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50";
  if (score >= 50) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

export function ATSScore({
  score,
  missingKeywords,
}: {
  score: number;
  missingKeywords: string[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-lg font-semibold ${scoreColor(score)}`}>
          {score}
        </span>
        <span className="text-sm text-gray-600">ATS match score</span>
      </div>
      {missingKeywords.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Missing keywords
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingKeywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
