import { BLOG_CATEGORIES } from "@/lib/blog/posts";

/** Shared "Learning" nav dropdown items, sourced from the real blog categories so the
 * marketing header dropdown never lists a category the /blog filter doesn't support. */
export const LEARNING_DROPDOWN_ITEMS = [
  { href: "/blog", label: "All Guides", description: BLOG_CATEGORIES[0].description },
  ...BLOG_CATEGORIES.filter((category) => category.id !== "all").map((category) => ({
    href: `/blog?category=${category.id}`,
    label: category.label,
    description: category.description,
  })),
];
