import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog/posts";
import { BlogIndexView } from "@/components/blog/BlogIndexView";

export const metadata: Metadata = {
  title: "Australian Career Blog & ATS Resume Guides | ApplyLab",
  description:
    "Expert advice for Australian job seekers. Master the Australian resume format, pass Workday & SEEK ATS algorithms, address APS key selection criteria, and negotiate salaries.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Australian Career Blog & ATS Resume Guides | ApplyLab",
    description:
      "Expert advice for Australian job seekers. Master the Australian resume format, pass Workday & SEEK ATS algorithms, address APS selection criteria, and negotiate salaries.",
    url: "https://applylab.io/blog",
    siteName: "ApplyLab",
    locale: "en_AU",
    type: "website",
    // Interim fallback - there's no per-article cover image system yet. Swap for a real blog
    // banner once one exists.
    images: ["/logo-icon.png"],
  },
  twitter: {
    // "summary" not "summary_large_image": logo-icon.png is a square app icon, and stretching a
    // square image into the large-image card's wide slot looks bad. Switch back once a real
    // wide banner image exists.
    card: "summary",
    title: "Australian Career Blog & ATS Resume Guides | ApplyLab",
    description:
      "Expert advice for Australian job seekers. Master Australian resumes, APS criteria, and SEEK ATS algorithms.",
    images: ["/logo-icon.png"],
  },
};

// Not async, and no getCurrentUser() call: see app/page.tsx for why.
export default function BlogPage() {
  const posts = getAllPosts();

  return <BlogIndexView posts={posts} />;
}
