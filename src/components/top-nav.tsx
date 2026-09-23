"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

// Minimal stand-in for the live app's sidebar/mobile-nav chrome (see CLAUDE.md's "mobile nav
// chrome" section) -- just enough real Next.js routing between ported tabs to validate
// navigation, not a port of that chrome itself. Real per-tab routes (/, /draft) rather than a
// client-side tab switcher, so the browser back button and direct links work like a real app.
const TABS = [
  { href: "/", label: "Overview" },
  { href: "/draft", label: "Draft" },
  { href: "/episodes", label: "Episodes" },
  { href: "/mid-season", label: "Mid-Season" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border bg-panel-menu">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 sm:px-6">
        {TABS.map((tab) => (
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
