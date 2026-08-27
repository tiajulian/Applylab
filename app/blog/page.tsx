import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/getCurrentUser";
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

function initialsFor(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return initials.toUpperCase();
}

export default async function BlogPage() {
  const user = await getCurrentUser();
  const posts = getAllPosts();

  const userSession = {
    isLoggedIn: !!user,
    initials: user ? initialsFor(user.appUser?.full_name, user.authEmail) : undefined,
  };

  return <BlogIndexView posts={posts} userSession={userSession} />;
}
