import { OverviewDashboard } from "@/components/overview/overview-dashboard";

// No wrapping <main>/background here -- AuthGate's shell (sidebar + content column) owns that
// now, matching the live app's single #content mount point inside its .app-shell.
export default function Home() {
  return <OverviewDashboard />;
}
