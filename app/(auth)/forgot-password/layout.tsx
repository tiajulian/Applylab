import type { Metadata } from "next";

// The page itself is a client component, which can't export metadata.
export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
