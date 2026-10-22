import type { MetadataRoute } from "next";
import { EXHIBITS } from "./exhibits";
import { getSiteUrl } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    {
      url: siteUrl,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...EXHIBITS.map((exhibit) => ({
      url: `${siteUrl}/exhibits/${exhibit.id}`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
      images: exhibit.image ? [`${siteUrl}${exhibit.image.url}`] : undefined,
    })),
  ];
}
