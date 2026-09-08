import { UpgradeCard } from "@/components/upgrade/UpgradeCard";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";

// Mirrors the real, currently-enforced limits (lib/requireUser.ts's FREE_RESUME_LIMIT,
// FREE_ASSIST_LIMIT_PER_RESUME, and FREE_TIER_FEATURE_LIMITS) - update this copy if those change,
// there's no shared source of truth between the two yet.
export default function UpgradePage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-paper px-4 py-16">
      <Reveal className="flex flex-col items-center">
        <h1 className="font-display text-display text-ink text-center">Choose your plan</h1>
        <p className="mt-2 max-w-md text-center text-body text-ink-secondary">
          Try ApplyLab&apos;s AI for free, then keep building for free forever - or go Pro for
          unlimited resumes, cover letters, PDF downloads, and ATS scoring tailored for the
          Australian job market.
        </p>
      </Reveal>

      <StaggerList className="mt-10 grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <StaggerItem>
          <div className="flex h-full flex-col rounded-lg border border-border bg-surface p-8">
            <h2 className="text-h3 font-semibold text-ink">Free</h2>
            <p className="mt-2">
              <span className="font-display text-h2 text-ink">$0</span>{" "}
              <span className="text-ink-secondary">no card required</span>
            </p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Your free AI to get started
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-ink-secondary">
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                2 AI-tailored resumes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                10 AI edits per resume
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                2 cover letters, resume reviews &amp; skills bridges each to try
              </li>
            </ul>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Free forever, no limits
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-ink-secondary">
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Manual resume editing
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Save &amp; download your resumes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Track your job applications
              </li>
            </ul>

            <Button href="/signup" variant="outline" className="mt-8">
              Get started free
            </Button>
            <p className="mt-3 text-xs text-ink-muted">
              Your free AI is a one-time trial, not a monthly refill - it never expires, but it
              doesn&apos;t reset either.
            </p>
          </div>
        </StaggerItem>

        <StaggerItem>
          <UpgradeCard
            plan="pro"
            title="Pro"
            price="$19"
            cadence="/month"
            features={[
              "Unlimited resumes & cover letters",
              "Unlimited AI edits, reviews & skills bridges",
              "ATS keyword scoring",
              "PDF downloads",
            ]}
            highlight
          />
        </StaggerItem>
      </StaggerList>
    </main>
  );
}
