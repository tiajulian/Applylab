import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/PricingView";
import { PRO_PRICES } from "@/lib/marketing/plans";

export const metadata: Metadata = {
  title: "Pricing | ApplyLab: Tailored Resumes for Australian Jobs",
  description:
    `Start free with ApplyLab. Pro is ${PRO_PRICES.month.label} a month, or ${PRO_PRICES.quarter.label} every 3 months, for unlimited tailored resumes, cover letters and interview practice, built only from your real experience.`,
  alternates: {
    canonical: "/pricing",
  },
};

// Not async, and no getCurrentUser() call: see app/page.tsx for why.
export default function PricingPage() {
  return <PricingView />;
}
