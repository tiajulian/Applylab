import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/PricingView";

export const metadata: Metadata = {
  title: "Pricing & Plans | ApplyLab - AI Job Copilot for Australia",
  description:
    "Invest in your next career step. Land interviews 3x faster with ApplyLab's AI Job Copilot built specifically for Australian job seekers. Start free with 2 tailored applications.",
  alternates: {
    canonical: "/pricing",
  },
};

// Not async, and no getCurrentUser() call: see app/page.tsx for why.
export default function PricingPage() {
  return <PricingView />;
}
