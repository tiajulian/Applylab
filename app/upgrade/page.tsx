import Link from "next/link";
import { UpgradeCard } from "@/components/upgrade/UpgradeCard";
import { Logo } from "@/components/marketing/Logo";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ArrowLeftIcon, CheckIcon } from "@/components/ui/icons/LucideIcons";
import { CTA } from "@/lib/marketing/copy";
import { PLANS } from "@/lib/marketing/plans";
import { ManageBillingButton } from "@/components/profile/BillingSection";
import { formatEnAuDate } from "@/lib/dateUtils";
import type { ProSubscriptionSummary } from "@/lib/stripe/client";

export const metadata = { title: "Subscription & plan | ApplyLab" };

/** The live subscription's dates, or null (comped Pro, Stripe unavailable). Imported lazily: the
 * Stripe client throws at import when its keys are missing (Preview builds). */
async function loadSubscription(customerId: string | null | undefined): Promise<ProSubscriptionSummary | null> {
  if (!customerId) return null;
  try {
    const { getProSubscriptionSummary } = await import("@/lib/stripe/client");
    return await getProSubscriptionSummary(customerId);
  } catch (error) {
    console.error("upgrade page subscription lookup failed", error);
    return null;
  }
}

export default async function UpgradePage() {
  // Signed-in visitors came from inside the app: give them a way back, and don't send the Free
  // card's button to /signup (they already have an account).
  const user = await getCurrentUser();
  const signedIn = Boolean(user && !user.isAnonymous);
  const isPro = user?.appUser?.plan === "pro";
  const home = signedIn ? "/dashboard" : "/";
  const customerId = user?.appUser?.stripe_customer_id;
  const subscription = isPro ? await loadSubscription(customerId) : null;

  return (
    <main className="flex min-h-screen flex-col items-center bg-paper px-4 pb-16">
      <header className="flex w-full max-w-3xl items-center justify-between py-4">
        <Logo href={home} />
        <Link
          href={home}
          className="inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-[14px] font-medium text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {signedIn ? "Back to ApplyLab" : "Back"}
        </Link>
      </header>
      <div className="h-6 sm:h-10" aria-hidden="true" />
      {isPro ? (
        <CurrentProPlan subscription={subscription} canManageBilling={Boolean(customerId)} />
      ) : (
        <PlanChooser signedIn={signedIn} />
      )}
    </main>
  );
}

/** A Pro member sees their plan and how to manage or cancel it, never "Go Pro". */
function CurrentProPlan({
  subscription,
  canManageBilling,
}: {
  subscription: ProSubscriptionSummary | null;
  canManageBilling: boolean;
}) {
  const periodEnd = subscription?.periodEnd ? formatEnAuDate(subscription.periodEnd, { includeYear: true }) : null;
  return (
    <Reveal className="flex w-full max-w-xl flex-col items-center">
      <h1 className="font-display text-display text-ink text-center">Your plan</h1>
      <div className="mt-8 w-full rounded-lg border border-border bg-surface p-8">
        <p className="text-sm font-medium text-ink-secondary">Current plan</p>
        <h2 className="mt-1 text-h3 font-semibold text-ink">{PLANS.pro.name}</h2>
        {periodEnd && (
          <p className="mt-2 text-sm text-ink-secondary">
            {subscription?.cancelsAtPeriodEnd ? `Cancelled. You keep Pro until ${periodEnd}.` : `Renews on ${periodEnd}.`}
          </p>
        )}
        <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-secondary">
          {PLANS.pro.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>
        {canManageBilling ? (
          <>
            <ManageBillingButton label="Manage billing or cancel" className="mt-8" />
            <p className="mt-3 text-xs text-ink-muted">
              Change your payment method, see invoices, or cancel. Cancelling stops the next renewal; you keep Pro until
              the end of the period you&apos;ve paid for.
            </p>
          </>
        ) : (
          <p className="mt-8 text-sm text-ink-secondary">Your Pro access was set up by the ApplyLab team, so there&apos;s nothing to bill.</p>
        )}
      </div>
    </Reveal>
  );
}

function PlanChooser({ signedIn }: { signedIn: boolean }) {
  return (
    <>
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

            <Button href={signedIn ? "/dashboard" : "/signup"} variant="outline" className="mt-8">
              {signedIn ? "Stay on Free" : CTA.startFree}
            </Button>
            <p className="mt-3 text-xs text-ink-muted">
              Free uses don&apos;t top up each month, but they never run out by date either.
            </p>
          </div>
        </StaggerItem>

        <StaggerItem>
          <UpgradeCard
            title={PLANS.pro.name}
            audience={PLANS.pro.audience}
            features={PLANS.pro.features}
            highlight
          />
        </StaggerItem>
      </StaggerList>
    </>
  );
}
