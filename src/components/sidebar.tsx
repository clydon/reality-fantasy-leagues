"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated } from "@/lib/store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useChatStore } from "@/lib/chat-store";
import { useNotificationsStore } from "@/lib/notifications-store";
import { midseasonBadge } from "@/lib/game/selectors";
import { LeagueSwitcher } from "@/components/league-switcher";
import { cn } from "cn";

// Port of the live app's real desktop sidebar chrome -- .sidebar/#tabs/.brand in
// public/styles.css, populated by renderTabs() in public/app.js. Values below (224px width,
// 20px/12px padding, 9px/12px button padding, the #fbeee8 active tint, etc.) are copied from
// that CSS, not approximated. Mobile chrome is a separate component (mobile-nav/mobile-nav.tsx),
// shown/hidden via the max-nav breakpoint rather than duplicated here.
const TABS = [
  { href: "/", label: "Overview" },
  { href: "/draft", label: "Draft" },
  { href: "/episodes", label: "Episodes" },
  { href: "/mid-season", label: "Mid-Season" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/chat", label: "Chat" },
  { href: "/setup", label: "League Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  const isAuthenticated = useIsAuthenticated();
  const mode = useLeagueStore((s) => s.mode);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const openReportModal = useReportModalStore((s) => s.openModal);
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const chatUnread = useChatStore((s) => s.unreadCount);
  const tabs = isSuperAdmin ? [...TABS, { href: "/admin", label: "Admin" }, { href: "/reports", label: "Reports" }] : TABS;

  // Port of exitDemoMode() -- see auth-gate.tsx's handleExitDemo for why this always means "show
  // the login screen" here rather than the live app's silent-restore-if-still-logged-in path.
  function exitDemo() {
    enterMockMode();
    setEntered(false);
  }

  // Port of renderTabs()'s per-tab nav-badge logic (public/app.js): Mid-Season gets the
  // "Your Turn"/"Active" badge (midseasonBadge), Chat gets the unread count, and every other tab
  // gets a count of its own pending notifications (public/app.js: `notifications.filter(n =>
  // n.tab===id).length`) -- for this POC's ported feature set that's only ever Draft
  // ("it's your turn"), but the logic is generic, not special-cased to just that one tab.
  const notifications = useNotificationsStore((s) => s.notifications);
  function badgeFor(href: string): { label: string; urgent: boolean } | null {
    if (href === "/mid-season") return midseasonBadge(state, myPlayerId);
    if (href === "/chat" && chatUnread > 0) return { label: chatUnread > 9 ? "9+" : String(chatUnread), urgent: true };
    const count = notifications.filter((n) => n.tab === href).length;
    return count > 0 ? { label: count > 9 ? "9+" : String(count), urgent: true } : null;
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[224px] flex-none flex-col overflow-y-auto border-r border-border bg-panel-menu p-[20px_12px]">
      <div className="flex items-center justify-center px-0 pb-[18px] pt-1">
        <Link href="/" className="min-w-0 flex-1">
          <Image src="/sidebar-logo.jpg" alt="Survivor Fantasy Engine" width={855} height={301} className="h-auto w-full" priority />
        </Link>
      </div>

      {mode === "live" && leagueName && <LeagueSwitcher />}

      <nav className="flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const badge = badgeFor(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[7px] px-3 py-2.5 text-[0.9rem] font-semibold text-muted-foreground transition-colors",
                active ? "bg-[#fbeee8] text-primary" : "hover:bg-secondary hover:text-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 flex-none rounded-full bg-current", active ? "opacity-100" : "opacity-35")} />
              {tab.label}
              {badge && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold leading-none text-white",
                    badge.urgent ? "bg-destructive" : "bg-accent-2"
                  )}
                >
                  {badge.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border px-2.5 pb-1 pt-3">
        {/* Report an Issue posts as the real signed-in SurvivorDraft user (server-side
            requireAuth) -- gated on real authentication (isAuthenticated/userId), not `mode`,
            since a super-admin with no personal league is genuinely signed in but stays
            mode:'mock' (no league to show live). Using `mode` here blocked that real case. */}
        {isAuthenticated && (
          <button className="mb-1.5 block text-[0.8rem] font-semibold text-primary hover:underline" onClick={openReportModal}>
            Report an Issue
          </button>
        )}
        {mode === "mock" ? (
          <p className="text-[0.8rem] text-muted-foreground">
            Viewing demo data.{" "}
            {!isAuthenticated && (
              <button className="font-semibold text-primary hover:underline" onClick={exitDemo}>
                Sign in
              </button>
            )}
          </p>
        ) : (
          <button className="text-[0.8rem] font-semibold text-primary hover:underline" onClick={enterMockMode}>
            Switch to demo data
          </button>
        )}
      </div>
    </aside>
  );
}
