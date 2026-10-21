import { Button } from "@/components/ui/Button";

/** Rendered by the segment-level not-found.tsx files under (dashboard), so an unknown, deleted or
 * someone else's document ID shows a friendly state inside the app shell (with a 404 status)
 * instead of falling through to the root not-found boundary. */
export function DocumentNotFound({ kind }: { kind: "resume" | "cover letter" }) {
  const label = kind === "resume" ? "Resume" : "Cover letter";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-16 text-center">
      <h1 className="font-display text-h2 text-ink">{label} not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
        This {kind} doesn&apos;t exist, has been deleted, or belongs to another account.
      </p>
      <Button href={kind === "resume" ? "/documents" : "/cover-letter"} className="mt-6">
        Back to {kind === "resume" ? "Resumes" : "Cover letters"}
      </Button>
    </div>
  );
}
