import { AdminGate } from "@/components/admin/admin-shell";

// The admin area (docs/PLAN-ux-redesign.md 3a): one gate for every page under /admin.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminGate>{children}</AdminGate>;
}
