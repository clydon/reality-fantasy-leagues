import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";

// "/" is the landing page for anyone signed out (AuthGate), so its metadata is the landing page's.
const DESCRIPTION =
  "Free fantasy games for any TV show. Draft the cast of Survivor, The Traitors, The Challenge or any show you watch, set a lineup each week, and play with your friends. Spoiler-safe, works on any phone.";
export const metadata: Metadata = {
  title: { absolute: "Game Your Show: turn any TV show into a game with friends" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Game Your Show: turn any TV show into a game",
    description: "Draft the cast, set a lineup, call the boot. Free for your whole couch, for any show you bring.",
  },
};

// No wrapping <main>/background here -- AuthGate's shell (sidebar + content column) owns that
// now, matching the live app's single #content mount point inside its .app-shell.
export default function Home() {
  return <OverviewDashboard />;
}
