"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BlogPost, BlogCategory } from "@/lib/blog/types";
import { BLOG_CATEGORIES } from "@/lib/blog/posts";
import { BlogHeader } from "./BlogHeader";
import { BlogCard } from "./BlogCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";

interface BlogIndexViewProps {
  posts: BlogPost[];
  userSession?: {
    isLoggedIn: boolean;
    initials?: string;
  };
}

export function BlogIndexView({ posts, userSession }: BlogIndexViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPosts = useMemo(() => {
    let result = posts;

    if (selectedCategory !== "all") {
      result = result.filter((post) => post.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((post) => {
        return (
          post.title.toLowerCase().includes(q) ||
          post.subtitle.toLowerCase().includes(q) ||
          post.metaDescription.toLowerCase().includes(q) ||
          post.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          post.categoryLabel.toLowerCase().includes(q) ||
          post.author.name.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [posts, selectedCategory, searchQuery]);

  const featuredPost = useMemo(() => {
    return posts.find((p) => p.featured) || posts[0];
  }, [posts]);

  // If showing "all" and no search query, separate the featured post from the grid
  const showFeaturedSpotlight = selectedCategory === "all" && !searchQuery.trim() && featuredPost;
  const gridPosts = showFeaturedSpotlight
    ? filteredPosts.filter((p) => p.slug !== featuredPost.slug)
    : filteredPosts;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-accent-soft selection:text-accent">
      <BlogHeader userSession={userSession} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border bg-surface/50 py-10 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-accent shadow-sm">
                <SparklesIcon className="h-3.5 w-3.5" />
                AUSTRALIAN CAREER GUIDES &amp; ATS PLAYBOOKS
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink leading-tight">
                Insights for the Australian Job Market.
              </h1>

              <p className="text-body sm:text-body-lg text-ink-secondary leading-relaxed">
                Practical, recruiter-tested advice on Australian resume formatting, APS government selection criteria, SEEK algorithms, and salary negotiation.
              </p>

              {/* Search Bar */}
              <div className="pt-2 mx-auto max-w-lg">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search guides (e.g. 'SEEK ATS', 'Selection Criteria', 'Salary')..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 rounded-xl border-border bg-surface text-ink placeholder:text-ink-muted shadow-sm focus:border-accent focus:ring-accent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-muted hover:text-ink px-1.5 py-0.5 rounded"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Container */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 space-y-10">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {BLOG_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-fast ${
                    isSelected
                      ? "bg-accent text-on-accent shadow-sm"
                      : "bg-surface text-ink-secondary border border-border hover:border-accent/40 hover:text-ink"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Featured Spotlight Card */}
          {showFeaturedSpotlight && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Must-Read Guide
              </p>
              <BlogCard post={featuredPost} variant="featured" />
            </div>
          )}

          {/* Articles Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl sm:text-2xl text-ink">
                {searchQuery.trim()
                  ? `Search Results (${filteredPosts.length})`
                  : selectedCategory !== "all"
                  ? BLOG_CATEGORIES.find((c) => c.id === selectedCategory)?.label
                  : "All Career Guides"}
              </h2>

              <span className="text-xs text-ink-muted">
                Showing {filteredPosts.length} {filteredPosts.length === 1 ? "article" : "articles"}
              </span>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center space-y-3">
                <p className="text-body font-semibold text-ink">No articles found matching &quot;{searchQuery}&quot;</p>
                <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                  Try searching for a different keyword or browse all categories to explore our Australian career guides.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  className="mt-2 text-xs font-semibold"
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {gridPosts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </div>

          {/* Interactive Conversion Banner */}
          <section className="rounded-2xl border border-border bg-paper-deep p-6 sm:p-10 shadow-sm">
            <div className="mx-auto max-w-3xl text-center space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                🇦🇺 Built for Australian Job Seekers
              </span>

              <h2 className="font-display text-2xl sm:text-3xl text-ink leading-tight">
                Put these guides into practice. Tailor your resume in 30 seconds.
              </h2>

              <p className="text-sm sm:text-body text-ink-secondary max-w-xl mx-auto">
                ApplyLab analyzes your master career profile against any Australian SEEK or LinkedIn job description, crafting ATS-optimized 1-page resumes with 90%+ match scores.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup">
                  <Button size="md" className="font-bold px-6">
                    Start with 2 free applications &rarr;
                  </Button>
                </Link>
                <Link href="/#how-it-works">
                  <Button variant="outline" size="md" className="font-semibold px-5">
                    See How It Works
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8 text-xs text-ink-secondary">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row text-center sm:text-left">
          <p>© {new Date().getFullYear()} ApplyLab. All rights reserved. The Australian AI job-search copilot.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 font-medium">
            <Link href="/" className="hover:text-ink transition-colors">Home</Link>
            <Link href="/blog" className="text-accent font-bold transition-colors">Blog</Link>
            <Link href="/pricing" className="hover:text-ink transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
