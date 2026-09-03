import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { toMarketingUser } from "@/components/marketing/MarketingHeader";
import { PrivacyView } from "@/components/privacy/PrivacyView";

export const metadata: Metadata = {
  title: "Privacy Policy | ApplyLab - AI Job Copilot Australia",
  description:
    "Comprehensive Privacy Policy for ApplyLab. Compliant with the Australian Privacy Act 1988 (Cth), APPs, and featuring an ironclad Zero-Data AI Model Training Guarantee.",
  alternates: {
    canonical: "/privacy",
  },
};

export default async function PrivacyPage() {
  const user = await getCurrentUser();

  return <PrivacyView user={toMarketingUser(user)} />;
}
