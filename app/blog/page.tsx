import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { toMarketingUser } from "@/components/marketing/MarketingHeader";
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
    url: "https://applylab.com.au/blog",
    siteName: "ApplyLab",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Australian Career Blog & ATS Resume Guides | ApplyLab",
    description:
      "Expert advice for Australian job seekers. Master Australian resumes, APS criteria, and SEEK ATS algorithms.",
  },
};

export default async function BlogPage() {
  const user = await getCurrentUser();
  const posts = getAllPosts();

  return <BlogIndexView posts={posts} user={toMarketingUser(user)} />;
}
