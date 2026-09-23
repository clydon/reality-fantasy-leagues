import { Dashboard } from "@/components/dashboard/dashboard";

// Rendered without the Sidebar/MobileNav shell -- AuthGate special-cases this route (see
// auth-gate.tsx's STANDALONE_ROUTES).
export default function DashboardPage() {
  return <Dashboard />;
}
