import { UpgradeCard } from "@/components/upgrade/UpgradeCard";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";

export default function UpgradePage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-paper px-4 py-16">
      <Reveal className="flex flex-col items-center">
        <h1 className="font-display text-display text-ink text-center">Choose your plan</h1>
        <p className="mt-2 max-w-md text-center text-body text-ink-secondary">
          Unlimited resumes, cover letters, PDF downloads, and ATS scoring tailored for the
          Australian job market.
        </p>
      </Reveal>

      <StaggerList className="mt-10 grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <StaggerItem>
          <UpgradeCard
            plan="pro"
            title="Pro"
            price="$19"
            cadence="/month"
            features={[
              "Unlimited resumes & cover letters",
              "ATS keyword scoring",
              "PDF downloads",
              "Cancel anytime",
            ]}
          />
        </StaggerItem>
        <StaggerItem>
          <UpgradeCard
            plan="lifetime"
            title="Lifetime"
            price="$79"
            cadence="one-time"
            features={[
              "Everything in Pro",
              "Pay once, use forever",
              "Future features included",
            ]}
            highlight
          />
        </StaggerItem>
      </StaggerList>
    </main>
  );
}
