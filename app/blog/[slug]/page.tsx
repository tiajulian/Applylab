import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { toMarketingUser } from "@/components/marketing/toMarketingUser";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";
import { BlogPostView } from "@/components/blog/BlogPostView";

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const post = getPostBySlug(params.slug);

  if (!post) {
    return {
      title: "Article Not Found | ApplyLab",
    };
  }

  const postUrl = `https://applylab.io/blog/${post.slug}`;

  return {
    title: `${post.title} | ApplyLab Blog`,
    description: post.metaDescription,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      url: postUrl,
      siteName: "ApplyLab",
      locale: "en_AU",
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      authors: [post.author.name],
      tags: post.tags,
      // Interim fallback - there's no per-article cover image system yet. Swap for a real
      // per-post image once one exists.
      images: ["/logo-icon.png"],
    },
    twitter: {
      // "summary" not "summary_large_image": logo-icon.png is a square app icon, and stretching a
      // square image into the large-image card's wide slot looks bad. Switch back once a real
      // wide banner image exists per post.
      card: "summary",
      title: post.title,
      description: post.metaDescription,
      images: ["/logo-icon.png"],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(post.slug, 3);
  const user = await getCurrentUser();

  // Google Rich Snippet JSON-LD Structured Data
  const jsonLdArticle = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
      jobTitle: post.author.role,
    },
    publisher: {
      "@type": "Organization",
      name: "ApplyLab",
      url: "https://applylab.io",
      logo: {
        "@type": "ImageObject",
        url: "https://applylab.io/icon.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://applylab.io/blog/${post.slug}`,
    },
    keywords: post.tags.join(", "),
  };

  const jsonLdBreadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://applylab.io",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://applylab.io/blog",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `https://applylab.io/blog/${post.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumbs) }}
      />
      <BlogPostView
        post={post}
        relatedPosts={relatedPosts}
        user={toMarketingUser(user)}
      />
    </>
  );
}
