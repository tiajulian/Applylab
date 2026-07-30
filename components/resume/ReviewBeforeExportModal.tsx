"use client";

import { Button } from "@/components/ui/Button";
import type { FactCheckFlag } from "@/types";

export function ReviewBeforeExportModal({
  flags,
  onConfirm,
  onCancel,
}: {
  flags: FactCheckFlag[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Review before you export</h2>

        {flags.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              We flagged {flags.length} {flags.length === 1 ? "detail" : "details"} in this resume that
              don&apos;t clearly trace back to what you told us — double-check these are accurate before
              you send this out.
            </p>
            <ul className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto">
              {flags.map((flag, i) => (
                <li key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="font-medium text-amber-900">{flag.location}</p>
                  <p className="mt-0.5 text-amber-800">{flag.message}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            No specific facts were flagged, but please give the resume a final read before exporting —
            you&apos;re the one who has to stand behind it in an interview.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onConfirm}>
            I&apos;ve reviewed it — export
          </Button>
        </div>
      </div>
    </div>
  );
}
