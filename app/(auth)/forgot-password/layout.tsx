import type { Metadata } from "next";

// The page itself is a client component, which can't export metadata.
// Not worth a search result, and they'd compete with the landing page.
export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your ApplyLab password.",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
