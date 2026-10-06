import type { MarketingNavLink } from "@/components/marketing/MarketingHeader";
import { LEARNING_DROPDOWN_ITEMS } from "@/lib/blog/learningNav";

/**
 * The one marketing nav used by every page with MarketingHeader. Lives outside
 * lib/marketing/copy.ts because the Learn dropdown pulls in lib/blog/posts.ts, which copy.ts's
 * dashboard/server importers shouldn't have to bundle.
 */
export const MARKETING_NAV_LINKS: MarketingNavLink[] = [
  { href: "/#how", label: "How it works" },
  { href: "/resume-score", label: "Free resume score", highlight: true },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Learn", dropdown: LEARNING_DROPDOWN_ITEMS },
];
