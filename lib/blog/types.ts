export type BlogCategory =
  | "all"
  | "resumes"
  | "selection-criteria"
  | "ats-platforms"
  | "interviews-salaries";

export interface BlogCategoryMeta {
  id: BlogCategory;
  label: string;
  description: string;
  badgeColor?: string;
}

export interface BlogAuthor {
  name: string;
  role: string;
  avatarUrl?: string;
  initials: string;
  bio: string;
}

export interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

export interface BlogPost {
  slug: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  publishedAt: string; // ISO date string e.g. "2026-08-20"
  updatedAt?: string;
  readingTimeMinutes: number;
  category: Exclude<BlogCategory, "all">;
  categoryLabel: string;
  tags: string[];
  featured?: boolean;
  author: BlogAuthor;
  tableOfContents: TableOfContentsItem[];
  content: string; // Rich Markdown string with Australian callout sections
  keyTakeaways: string[];
  targetAudience: string;
}
