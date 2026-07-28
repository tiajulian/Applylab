export function CompletenessMeter({ completeness }: { completeness: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900">Profile completeness</span>
        <span className="text-gray-500">{completeness}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${completeness}%` }}
        />
      </div>
    </div>
  );
}
