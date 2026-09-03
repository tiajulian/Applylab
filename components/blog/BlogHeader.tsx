import { MarketingHeader, type MarketingNavLink } from "@/components/marketing/MarketingHeader";
import type { UserMenuProps } from "@/components/dashboard/UserAvatarMenu";

const NAV_LINKS: MarketingNavLink[] = [
  { href: "/resume-score", label: "Free Resume Score", highlight: true },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-applylab", label: "Why ApplyLab" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog & Guides" },
];

interface BlogHeaderProps {
  user: UserMenuProps | null;
}

export function BlogHeader({ user }: BlogHeaderProps) {
  return (
    <MarketingHeader
      navLinks={NAV_LINKS}
      activeHref="/blog"
      user={user}
      ctaLabel="Start for free →"
      maxWidthClassName="max-w-6xl"
    />
  );
}
