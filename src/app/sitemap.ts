import type { MetadataRoute } from "next";

// The front door is the only page a signed-out crawler can actually see -- everything else sits
// behind AuthGate's session check. One URL is still worth a sitemap: it's what tells Google the
// canonical host (vs. www) and gives it a lastmod to re-check.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://gameyourshow.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
