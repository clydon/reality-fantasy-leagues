import { redirect } from "next/navigation";

// Reports moved into the admin area (docs/PLAN-ux-redesign.md 3g). Kept so old links still land.
export default function ReportsPage() {
  redirect("/admin/reports");
}
