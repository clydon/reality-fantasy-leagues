import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth-gate";
import { QueryProvider } from "@/components/query-provider";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

// Matches the live app's typography exactly (public/styles.css --font-body / --font-mono),
// so ported components need zero font-related visual tweaking.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Reality Fantasy Leagues",
  description: "Draft, score and trash-talk your reality TV fantasy league.",
  // iOS ignores most of the web manifest: without these it won't launch full-screen from the home
  // screen, and it would use a screenshot of the page instead of the icon.
  appleWebApp: {
    capable: true,
    title: "Fantasy Leagues",
    // "default" = a light status bar with dark text, content starting below it. Not
    // "black-translucent": that draws WHITE status-bar text over the page, which on this app's cream
    // background would make the clock and battery all but invisible.
    statusBarStyle: "default",
  },
  // No `icons` here on purpose: src/app/icon.png and src/app/apple-icon.png are Next's own file
  // conventions and generate the <link rel="icon"> / <link rel="apple-touch-icon"> tags with the
  // right type and sizes. They replaced the framework's default favicon.ico, which was still
  // Vercel's triangle -- deleting that file is what actually stops it being served, since a
  // favicon.ico in app/ wins over everything else.
};

// viewportFit "cover" is what makes env(safe-area-inset-*) non-zero on notched iPhones -- the mobile
// nav and main padding already use those insets but got 0 without it. themeColor tints the Android
// status bar / browser chrome to match the manifest.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#cc5b39",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <ServiceWorkerRegistrar />
        <QueryProvider>
          <AuthGate>{children}</AuthGate>
        </QueryProvider>
      </body>
    </html>
  );
}
