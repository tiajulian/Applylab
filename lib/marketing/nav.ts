import type { MarketingNavLink } from "@/components/marketing/MarketingHeader";
import { LEARNING_DROPDOWN_ITEMS } from "@/lib/blog/learningNav";
import { PRODUCT_NAV_COLUMNS } from "@/lib/marketing/productNav";

/**
 * The one marketing nav used by every page with MarketingHeader. Mirrors the home page nav
 * (MarketingNav): Product ▾ / Interview practice / Pricing / Learn. Lives outside
 * lib/marketing/copy.ts because the Learn dropdown pulls in lib/blog/posts.ts, which copy.ts's
 * dashboard/server importers shouldn't have to bundle.
 */
export const MARKETING_NAV_LINKS: MarketingNavLink[] = [
  {
    href: "/",
    label: "Product",
    dropdown: PRODUCT_NAV_COLUMNS.flatMap((col) =>
      col.links.map((link) => ({ href: `/${link.href}`, label: link.title, description: link.note })),
    ),
  },
  { href: "/#interview", label: "Interview practice" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Learn", dropdown: LEARNING_DROPDOWN_ITEMS },
];
