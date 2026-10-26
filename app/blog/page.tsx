import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllPosts } from "@/lib/blog/posts";
import { BlogIndexView } from "@/components/blog/BlogIndexView";

export const metadata: Metadata = {
  title: "Australian Career Blog & ATS Resume Guides",
  description:
    "Free guides from ApplyLab, which tailors your resume to each Australian job ad using only your real experience. Covers ATS, SEEK, APS selection criteria and salary.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Australian Career Blog & ATS Resume Guides | ApplyLab",
    description:
      "Free guides from ApplyLab, which tailors your resume to each Australian job ad using only your real experience. Covers ATS, SEEK, APS selection criteria and salary.",
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
      "Free guides from ApplyLab, which tailors your resume to each Australian job ad using only your real experience.",
    images: ["/logo-icon.png"],
  },
};

// Not async, and no getCurrentUser() call: see app/page.tsx for why.
export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <Suspense fallback={null}>
      <BlogIndexView posts={posts} />
    </Suspense>
  );
}
