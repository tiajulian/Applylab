import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://applylab.io";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/profile",
        "/resume/",
        "/applications",
        "/documents",
        "/interview",
        "/extension",
        "/admin",
        "/auth/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
