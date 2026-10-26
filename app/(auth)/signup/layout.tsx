import type { Metadata } from "next";

// The page itself is a client component, which can't export metadata.
export const metadata: Metadata = { title: "Sign up" };

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
