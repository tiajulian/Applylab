import { UpgradeCard } from "@/components/upgrade/UpgradeCard";

export default function UpgradePage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-16">
      <h1 className="text-3xl font-semibold text-gray-900">Choose your plan</h1>
      <p className="mt-2 max-w-md text-center text-gray-500">
        Unlimited resumes, cover letters, PDF downloads, and ATS scoring tailored for the
        Australian job market.
      </p>

      <div className="mt-10 grid w-full max-w-3xl gap-6 sm:grid-cols-2">
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
      </div>
    </main>
  );
}
