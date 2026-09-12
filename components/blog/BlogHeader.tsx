import { MarketingHeader, type MarketingNavLink } from "@/components/marketing/MarketingHeader";

const NAV_LINKS: MarketingNavLink[] = [
  { href: "/resume-score", label: "Free Resume Score", highlight: true },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-applylab", label: "Why ApplyLab" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog & Guides" },
];

export function BlogHeader() {
  return (
    <MarketingHeader
      navLinks={NAV_LINKS}
      activeHref="/blog"
      ctaLabel="Start for free →"
      maxWidthClassName="max-w-6xl"
    />
  );
}
