import type { MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest and linked automatically by Next.js. This is
// what makes the site installable ("Add to Home screen" / "Install app") on Android, and supplies the
// name, icon and colours iOS uses too (iOS additionally reads the apple-* tags in app/layout.tsx).
//
// Colours match globals.css: background_color is the splash-screen fill while the app boots and
// theme_color tints the Android status bar and task switcher. Both are the night ground, the icon's
// own field, so the splash is one dark screen with the lower-third mark on it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reality Fantasy Leagues",
    short_name: "Fantasy Leagues",
    description: "Draft, score and trash-talk your reality TV fantasy league.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#16141d",
    theme_color: "#16141d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Padded to the central 80% safe zone so Android's circle/squircle crops never clip the torch.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
