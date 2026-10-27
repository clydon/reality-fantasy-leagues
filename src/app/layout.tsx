import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth-gate";
import { MotionProvider } from "@/components/motion";
import { NoLinkMenu } from "@/components/no-link-menu";
import { QueryProvider } from "@/components/query-provider";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { THEME_BOOT_SCRIPT } from "@/lib/theme-script";

// Archivo is the one UI family (docs/PLAN-ux-redesign.md, direction A "Lower Third"). It's variable on
// both weight and width: normal width for everything you read, the condensed end (font-stretch 62%,
// the `display` utility in globals.css) for names, numbers and headings, like a broadcast caption.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const DESCRIPTION = "Draft, score and trash-talk your reality TV fantasy league.";

export const metadata: Metadata = {
  // Resolves relative URLs below (and the opengraph-image.tsx route) against the real domain --
  // without it, metadata generated during a Vercel preview build would bake in the preview host.
  // www, not the bare apex: gameyourshow.com 308s to www.gameyourshow.com (Vercel's own redirect,
  // see trustedOrigins in auth.ts), so the canonical host has to be the one that doesn't redirect.
  metadataBase: new URL("https://www.gameyourshow.com"),
  title: {
    default: "Game Your Show",
    template: "%s · Game Your Show",
  },
  description: DESCRIPTION,
  keywords: ["reality TV fantasy league", "fantasy draft", "Survivor fantasy league", "reality TV game"],
  openGraph: {
    title: "Game Your Show",
    description: DESCRIPTION,
    url: "/",
    siteName: "Game Your Show",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Your Show",
    description: DESCRIPTION,
    site: "@gameyourshow",
    creator: "@gameyourshow",
  },
  // iOS ignores most of the web manifest: without these it won't launch full-screen from the home
  // screen, and it would use a screenshot of the page instead of the icon.
  appleWebApp: {
    capable: true,
    title: "Game Your Show",
    // "default" = a light status bar with dark text, content starting below it. Not
    // "black-translucent": that draws WHITE status-bar text over the page, which on this app's cream
    // background would make the clock and battery all but invisible.
    statusBarStyle: "default",
  },
  // No `icons` here on purpose: src/app/icon1.png (32px), icon2.png (16px) and apple-icon.png are
  // Next's own file conventions and generate the <link rel="icon"> / <link rel="apple-touch-icon">
  // tags with the right type and sizes. They replaced the framework's default favicon.ico, which was still
  // Vercel's triangle -- deleting that file is what actually stops it being served, since a
  // favicon.ico in app/ wins over everything else.
};

// viewportFit "cover" is what makes env(safe-area-inset-*) non-zero on notched iPhones -- the mobile
// nav and main padding already use those insets but got 0 without it. themeColor tints the Android
// status bar / browser chrome to each theme's ground (the studio-ground and night-ground tokens).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecebf1" },
    { media: "(prefers-color-scheme: dark)", color: "#16141d" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Better Auth's session cookie ("__Secure-" prefixed on https). Just whether one exists: AuthGate
  // uses it to serve the landing page to signed-out visitors in the server render.
  const hasSession = (await cookies()).getAll().some((c) => c.name.endsWith("better-auth.session_token"));
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}
      // The inline script below adds `dark` before React hydrates; the DOM's class list wins.
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme (src/lib/theme.ts) before the first paint, so choosing dark
            doesn't flash light on every load. Per Next's "preventing flash before hydration" guide. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        <ServiceWorkerRegistrar />
        <NoLinkMenu />
        <QueryProvider>
          <MotionProvider>
            <AuthGate hasSession={hasSession}>{children}</AuthGate>
          </MotionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
