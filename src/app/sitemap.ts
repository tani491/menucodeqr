import type { MetadataRoute } from "next";
import { demoSlugs, siteUrl } from "@/lib/seo";
import { getMenuBySlug } from "@/lib/menu-data";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const demos = await Promise.all(demoSlugs.map(async slug => {
    const menu = await getMenuBySlug(slug);
    return menu && !menu.restaurant.isSuspended ? `/menu/${slug}` : null;
  }));
  return ["/", "/login", ...demos.filter((path): path is string => path !== null)].map(path => ({ url: new URL(path, siteUrl).href, changeFrequency: "weekly", priority: path === "/" ? 1 : 0.5 }));
}
