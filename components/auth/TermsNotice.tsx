import Link from "next/link";
import { clsx } from "@/lib/utils";

const linkClass = "font-medium text-accent underline hover:text-accent-hover";

// Clicking a signup button counts as accepting the terms, so this sits above the first of
// those buttons (Google), where it's read before either one, in place of a checkbox.
export function TermsNotice({ className }: { className?: string }) {
  return (
    <p className={clsx("text-center text-xs text-ink-muted", className)}>
      By continuing, you agree to our{" "}
      <Link href="/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Terms and Conditions
      </Link>{" "}
      and{" "}
      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}
