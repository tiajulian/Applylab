import Link from "next/link";

/**
 * The quiet line shown in place of an empty result when a soft-capped AI helper (one that returns
 * nothing instead of an error) has used up its free allowance. No modal: it's a nicety, not a wall.
 */
export function FreeSuggestionsUsed({ className = "mt-3" }: { className?: string }) {
  return (
    <p className={`${className} text-xs text-ink-secondary`}>
      Free suggestions used.{" "}
      <Link href="/pricing" className="font-medium text-accent hover:underline">
        Go Pro for more.
      </Link>
    </p>
  );
}
