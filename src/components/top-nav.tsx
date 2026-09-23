"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useIsSuperAdmin } from "@/lib/store";

// Minimal stand-in for the live app's sidebar/mobile-nav chrome (see CLAUDE.md's "mobile nav
// chrome" section) -- just enough real Next.js routing between ported tabs to validate
// navigation, not a port of that chrome itself. Real per-tab routes (/, /draft) rather than a
// client-side tab switcher, so the browser back button and direct links work like a real app.
const TABS = [
  { href: "/", label: "Overview" },
  { href: "/draft", label: "Draft" },
  { href: "/episodes", label: "Episodes" },
  { href: "/mid-season", label: "Mid-Season" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/chat", label: "Chat" },
];

export function TopNav() {
  const pathname = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  // Same gate as the live app's own admin dash-link (public/app.js: only rendered for
  // currentUser.isSuperAdmin) -- the tab isn't just inert for non-super-admins, it's not shown.
  const tabs = isSuperAdmin ? [...TABS, { href: "/admin", label: "Admin" }] : TABS;
  return (
    <nav className="border-b border-border bg-panel-menu">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 sm:px-6">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-3 text-sm font-semibold",
              pathname === tab.href
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
