import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth-gate";
import { TopNav } from "@/components/top-nav";

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
  description: "Fantasy draft engine for reality competition shows — Next.js proof of concept.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <TopNav />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
