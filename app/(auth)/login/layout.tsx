import type { Metadata } from "next";

// The page itself is a client component, which can't export metadata.
export const metadata: Metadata = { title: "Log in" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
