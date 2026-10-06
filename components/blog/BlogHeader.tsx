import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MARKETING_NAV_LINKS } from "@/lib/marketing/nav";

export function BlogHeader() {
  return (
    <MarketingHeader
      navLinks={MARKETING_NAV_LINKS}
      activeHref="/blog"
      maxWidthClassName="max-w-6xl"
    />
  );
}
