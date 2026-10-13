import type { MetadataRoute } from "next";

// Nearly everything past the front door requires a session (AuthGate) -- a crawler can't get past
// login anyway, but disallowing these explicitly stops it burning crawl budget on login-walled
// pages that would otherwise show up as duplicate/empty titles.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/dashboard", "/account", "/setup/"],
    },
    sitemap: "https://www.gameyourshow.com/sitemap.xml",
  };
}
