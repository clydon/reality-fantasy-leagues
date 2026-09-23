import { OverviewDashboard } from "@/components/overview/overview-dashboard";
import { AuthGate } from "@/components/auth-gate";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <AuthGate>
        <OverviewDashboard />
      </AuthGate>
    </main>
  );
}
