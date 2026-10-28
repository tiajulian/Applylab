import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

// The landing page is a client component, which can't export metadata.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return <LandingPage />;
}
