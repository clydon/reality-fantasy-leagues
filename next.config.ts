import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The service worker must never be served from a cache: browsers only pick up a new sw.js when
  // they can fetch it fresh, so a cached copy would pin every installed phone to an old worker.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
