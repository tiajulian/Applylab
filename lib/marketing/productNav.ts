/**
 * The "Product" menu shared by the home page nav (MarketingNav) and the inner-page header
 * (MarketingHeader via lib/marketing/nav.ts), so both navs list the same items in the same order.
 * Hrefs are home page section anchors; inner pages prefix them with "/". Every anchor is a home
 * page section that always renders (#stories only renders with enough real quotes, so it isn't
 * linked here). Kept dependency-free so the home page doesn't bundle the blog posts.
 */
export const PRODUCT_NAV_COLUMNS = [
  {
    head: "Check and fix",
    links: [
      { href: "#score", title: "Free resume score", note: "See how strong your resume is" },
      { href: "#how", title: "How it works", note: "From job ad to tailored resume" },
      { href: "#stand-out", title: "Stand out", note: "Show what you achieved, not just what you did" },
    ],
  },
  {
    head: "Prepare and choose",
    links: [
      { href: "#interview", title: "Interview practice", note: "Rehearse out loud, get feedback" },
      { href: "#templates", title: "Resume templates", note: "Eight 1-page Australian layouts" },
      { href: "#faq", title: "FAQ", note: "Extension, interview practice and your data" },
    ],
  },
];
