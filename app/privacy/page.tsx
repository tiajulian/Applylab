import type { Metadata } from "next";
import { PrivacyView } from "@/components/privacy/PrivacyView";

export const metadata: Metadata = {
  title: "Privacy Policy | ApplyLab - AI Job Copilot Australia",
  description:
    "Comprehensive Privacy Policy for ApplyLab. Compliant with the Australian Privacy Act 1988 (Cth), APPs, and featuring an ironclad Zero-Data AI Model Training Guarantee.",
  alternates: {
    canonical: "/privacy",
  },
};

// Not async, and no getCurrentUser() call: see app/page.tsx for why.
export default function PrivacyPage() {
  return <PrivacyView />;
}
