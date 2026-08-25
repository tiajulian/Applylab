import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { PrivacyView } from "@/components/privacy/PrivacyView";

export const metadata: Metadata = {
  title: "Privacy Policy | ApplyLab - AI Job Copilot Australia",
  description:
    "Comprehensive Privacy Policy for ApplyLab. Compliant with the Australian Privacy Act 1988 (Cth), APPs, and featuring an ironclad Zero-Data AI Model Training Guarantee.",
  alternates: {
    canonical: "/privacy",
  },
};

function initialsFor(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return initials.toUpperCase();
}

export default async function PrivacyPage() {
  const user = await getCurrentUser();

  const userSession = {
    isLoggedIn: !!user,
    initials: user ? initialsFor(user.appUser?.full_name, user.authEmail) : undefined,
  };

  return <PrivacyView userSession={userSession} />;
}
