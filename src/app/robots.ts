import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: ["*", "Googlebot", "Bingbot", "GPTBot", "PerplexityBot"], allow: "/", disallow: ["/admin", "/dashboard", "/api/"] }], sitemap: `${siteUrl.origin}/sitemap.xml` };
}
