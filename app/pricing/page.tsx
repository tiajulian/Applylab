import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { PricingView } from "@/components/marketing/PricingView";

export const metadata: Metadata = {
  title: "Pricing & Plans | ApplyLab - AI Job Copilot for Australia",
  description:
    "Invest in your next career step. Land interviews 3x faster with ApplyLab's AI Job Copilot built specifically for Australian job seekers. Start free with 2 tailored applications.",
  alternates: {
    canonical: "/pricing",
  },
};

function initialsFor(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return initials.toUpperCase();
}

export default async function PricingPage() {
  const user = await getCurrentUser();

  const userSession = {
    isLoggedIn: !!user && !user.isAnonymous,
    initials: user && !user.isAnonymous ? initialsFor(user.appUser?.full_name, user.authEmail) : undefined,
  };

  return <PricingView userSession={userSession} />;
}
