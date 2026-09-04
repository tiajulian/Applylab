import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { toMarketingUser } from "@/components/marketing/toMarketingUser";
import { PricingView } from "@/components/marketing/PricingView";

export const metadata: Metadata = {
  title: "Pricing & Plans | ApplyLab - AI Job Copilot for Australia",
  description:
    "Invest in your next career step. Land interviews 3x faster with ApplyLab's AI Job Copilot built specifically for Australian job seekers. Start free with 2 tailored applications.",
  alternates: {
    canonical: "/pricing",
  },
};

export default async function PricingPage() {
  const user = await getCurrentUser();

  return <PricingView user={toMarketingUser(user)} />;
}
