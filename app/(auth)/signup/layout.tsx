import type { Metadata } from "next";

// The page itself is a client component, which can't export metadata.
// Not worth a search result, and they'd compete with the landing page.
export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a free ApplyLab account to tailor your resume to Australian job ads.",
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
