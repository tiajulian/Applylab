import { describe, it, expect } from "vitest";
import {
  getAllPosts,
  getPostBySlug,
  getPostsByCategory,
  getRelatedPosts,
  searchPosts,
  getAllCategories,
} from "@/lib/blog/posts";

describe("Blog data module", () => {
  it("returns all posts sorted by published date descending", () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThan(0);
    for (let i = 0; i < posts.length - 1; i++) {
      const current = new Date(posts[i].publishedAt).getTime();
      const next = new Date(posts[i + 1].publishedAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it("finds a post by slug", () => {
    const post = getPostBySlug("australian-resume-format-guide-2026");
    expect(post).toBeDefined();
    expect(post?.title).toContain("Australian Resume Format");
    expect(post?.category).toBe("resumes");
  });

  it("returns undefined for unknown slug", () => {
    const post = getPostBySlug("non-existent-slug-xyz");
    expect(post).toBeUndefined();
  });

  it("filters posts by category correctly", () => {
    const resumePosts = getPostsByCategory("resumes");
    expect(resumePosts.length).toBeGreaterThan(0);
    expect(resumePosts.every((p) => p.category === "resumes")).toBe(true);

    const allPosts = getPostsByCategory("all");
    expect(allPosts.length).toBe(getAllPosts().length);
  });

  it("finds related posts excluding the current post", () => {
    const slug = "australian-resume-format-guide-2026";
    const related = getRelatedPosts(slug, 3);
    expect(related.length).toBeLessThanOrEqual(3);
    expect(related.some((p) => p.slug === slug)).toBe(false);
  });

  it("searches posts by keyword", () => {
    const results = searchPosts("SEEK");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.slug === "beat-workday-seek-ats-australia")).toBe(true);
  });

  it("returns all categories", () => {
    const categories = getAllCategories();
    expect(categories.length).toBe(5);
    expect(categories.map((c) => c.id)).toContain("all");
    expect(categories.map((c) => c.id)).toContain("selection-criteria");
  });
});
