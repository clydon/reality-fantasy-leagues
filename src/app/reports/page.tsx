import { redirect } from "next/navigation";

// Reports moved into the admin area (docs/PLAN-ux-redesign.md 3g), now the desk's Find › Reports (docs/PLAN-desk-parity.md
// step 8). Kept so old links still land: /admin/reports sends a site admin on to the desk, and anyone else home.
export default function ReportsPage() {
  redirect("/admin/reports");
}
