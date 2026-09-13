import { MarketingHeader, type MarketingNavLink } from "@/components/marketing/MarketingHeader";
import { LEARNING_DROPDOWN_ITEMS } from "@/lib/blog/learningNav";

const NAV_LINKS: MarketingNavLink[] = [
  { href: "/resume-score", label: "Free Resume Score", highlight: true },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-applylab", label: "Why ApplyLab" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Learning", dropdown: LEARNING_DROPDOWN_ITEMS },
];

export function BlogHeader() {
  return (
    <MarketingHeader
      navLinks={NAV_LINKS}
      activeHref="/blog"
      maxWidthClassName="max-w-6xl"
    />
  );
}
