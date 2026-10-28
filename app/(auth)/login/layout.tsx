import type { Metadata } from "next";

// The page itself is a client component, which can't export metadata.
// Not worth a search result, and they'd compete with the landing page.
export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to ApplyLab to tailor your resume, practise interviews and track your applications.",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
