import { UpgradeCard } from "@/components/upgrade/UpgradeCard";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { CTA } from "@/lib/marketing/copy";
import { PLANS } from "@/lib/marketing/plans";

export default function UpgradePage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-paper px-4 py-16">
      <Reveal className="flex flex-col items-center">
        <h1 className="font-display text-display text-ink text-center">Choose your plan</h1>
        <p className="mt-2 max-w-md text-center text-body text-ink-secondary">
          Go Pro for unlimited tailored resumes and cover letters, downloads and interview
          practice.
        </p>
      </Reveal>

      <StaggerList className="mt-10 grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <StaggerItem>
          <div className="flex h-full flex-col rounded-lg border border-border bg-surface p-8">
            <h2 className="text-h3 font-semibold text-ink">{PLANS.free.name}</h2>
            <p className="mt-2">
              <span className="font-display text-h2 text-ink">{PLANS.free.priceLabel}</span>{" "}
              <span className="text-ink-secondary">no card required</span>
            </p>
            <p className="mt-2 text-sm text-ink-secondary">{PLANS.free.audience}</p>

            <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-secondary">
              {PLANS.free.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button href="/signup" variant="outline" className="mt-8">
              {CTA.startFree}
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
            title={PLANS.pro.name}
            price={`$${PLANS.pro.prices.monthly.amount}`}
            cadence="/month"
            audience={PLANS.pro.audience}
            features={PLANS.pro.features}
            highlight
          />
        </StaggerItem>
      </StaggerList>
    </main>
  );
}
