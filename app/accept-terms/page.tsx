import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { TERMS_VERSION } from "@/lib/terms";
import { AcceptTermsForm } from "@/components/auth/AcceptTermsForm";
import { Reveal } from "@/components/ui/Reveal";

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: { redirectedFrom?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const redirectedFrom = searchParams.redirectedFrom || "/dashboard";

  if (
    user.appUser?.accepted_terms_at &&
    user.appUser.accepted_terms_version === TERMS_VERSION
  ) {
    redirect(redirectedFrom);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <Reveal className="w-full max-w-sm">
        <div className="rounded border border-border bg-surface p-8">
          <h1 className="font-display text-h2 text-ink">Updated Terms and Conditions</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            We&apos;ve updated our Terms and Conditions. Please review and accept to keep using
            applylab.
          </p>
          <AcceptTermsForm redirectedFrom={redirectedFrom} />
        </div>
      </Reveal>
    </main>
  );
}
