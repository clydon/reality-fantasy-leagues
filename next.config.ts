import type { NextConfig } from "next";
import { UI_COOKIE } from "./src/new/routes";

// The two routes that embed text for research search (db/embeddings.js): research itself, which
// indexes what it found, and a side bet's suggested answer, which embeds the question.
const EMBEDDING_ROUTES = [
  "/api/admin/seasons/[id]/research",
  "/api/leagues/[leagueId]/episodes/[epId]/bets/[betId]/suggested-answer",
];

const nextConfig: NextConfig = {
  // Metadata goes in <head>, never streamed into <body>. The root layout reads cookies (the landing
  // page decides signed in or out on the server), which made every page dynamic and its metadata
  // streamed into a hidden <div>; hydration then sometimes raced it and failed. Our metadata is
  // static, so streaming bought nothing. (Crawlers always got it in <head> anyway.)
  htmlLimitedBots: /.*/,
  // Ship the embedding model (fetched into .models/ at build) and the ONNX runtime's Linux binary
  // with the routes that use them, so they read from disk instead of downloading on a cold start.
  outputFileTracingIncludes: Object.fromEntries(
    EMBEDDING_ROUTES.map((route) => [
      route.replace(/[[\]]/g, "\\$&"),
      ["./.models/**/*", "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**/*"],
    ])
  ),
  // onnxruntime-node ships binaries for every OS (~200MB), and onnxruntime-web isn't loaded on a
  // server at all. Without these, a traced function can pass the deploy size limit.
  outputFileTracingExcludes: {
    "/*": [
      "./node_modules/onnxruntime-node/bin/napi-v3/darwin/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v3/win32/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**/*",
      "./node_modules/onnxruntime-web/**/*",
    ],
  },
  // The full-site design mock, served as static files outside the app shell (public/mock/, built by
  // scripts/dev-test/publish-site-mock.js). /mock/hub is the older link people already have.
  // An account on the new design opens on /home (docs/PLAN-new-design.md step 0c): signed in (a session cookie,
  // whichever name it has on http and https) and this device's copy of the choice (src/lib/server/ui-choice.ts).
  // Here rather than in the page, so it's answered before anything renders; /home checks the session itself. A
  // device without the cookie yet gets there through AuthGate, which asks /api/me (and that sets the cookie).
  async redirects() {
    return ["better-auth.session_token", "__Secure-better-auth.session_token"].map((session) => ({
      source: "/",
      has: [
        { type: "cookie" as const, key: UI_COOKIE, value: "new" },
        { type: "cookie" as const, key: session },
      ],
      destination: "/home",
      permanent: false,
    }));
  },
  async rewrites() {
    return [
      { source: "/mock", destination: "/mock/site/index.html" },
      { source: "/mock/hub", destination: "/mock/site/index.html" },
    ];
  },
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
