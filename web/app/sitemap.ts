import type { MetadataRoute } from "next";
import registry from "../../registry/merchants.json";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(`${registry.updated}T00:00:00Z`);
  return [
    { url: `${SITE_URL}/`, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/check`, lastModified: updated, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/merchants`, lastModified: updated, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/docs`, lastModified: updated, changeFrequency: "monthly", priority: 0.7 },
  ];
}
