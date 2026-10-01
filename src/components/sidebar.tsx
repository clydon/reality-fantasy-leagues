"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useChatStore } from "@/lib/chat-store";
import { useNotificationsStore } from "@/lib/notifications-store";
import StateLogic from "@/lib/game/state-logic.js";
import { midseasonBadge } from "@/lib/game/selectors";
import { logOut } from "@/lib/auth-client";
import { LeagueSwitcher } from "@/components/league-switcher";
import { ThemePicker } from "@/components/theme-picker";
import { cn } from "cn";

// Port of the live app's real desktop sidebar chrome -- .sidebar/#tabs/.brand in
// public/styles.css, populated by renderTabs() in public/app.js. Values below (width aside -- widened from the live app's 224px so league names fit --
// 20px/12px padding, 9px/12px button padding, the #fbeee8 active tint, etc.) are copied from
// that CSS, not approximated. Mobile chrome is a separate component (mobile-nav/mobile-nav.tsx),
// shown/hidden via the max-nav breakpoint rather than duplicated here.
const TABS = [
  { href: "/", label: "Overview" },
  { href: "/draft", label: "Draft" },
  { href: "/episodes", label: "Episodes" },
  { href: "/mid-season", label: "Mid-Season" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/research", label: "Research" },
  { href: "/chat", label: "Chat" },
  { href: "/setup", label: "League Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  const isAuthenticated = useIsAuthenticated();
  const isPreviewingDemo = useIsPreviewingDemo();
  const mode = useLeagueStore((s) => s.mode);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const openDemoPicker = useDemoSeasonPickerStore((s) => s.openPicker);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const openReportModal = useReportModalStore((s) => s.openModal);
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const chatUnread = useChatStore((s) => s.unreadCount);

  // Whether there's a season to browse at all: a real league, or the demo one someone deliberately
  // stepped into. A signed-in user with no league has neither, and the league tabs would all be
  // views onto the demo season they didn't ask for -- so they get the two rows below instead, which
  // is what makes that first screen look like the app rather than a bare form.
  const hasSeason = mode === "live" || isPreviewingDemo;

  // Draft and Mid-Season are both roster concepts (a draft to run, a roster to replenish/swap) --
  // meaningless for a league type with no roster at all (pickem, whose weekly pick UI lives in
  // the Episode Card instead, under Episodes). Filtered here rather than removed from TABS
  // outright so a league type that DOES have a roster (classic-draft, and Active Roster later)
  // keeps seeing them.
  const hasRoster = StateLogic.getLeagueType(state).hasRoster;
  // Mid-Season is both optional AND opt-in: replenish and trade each need the league type to
  // support them and the commissioner to have turned them on (see replenishAvailable/tradeAvailable
  // in state-logic.js). With neither, the tab is an empty page explaining that it's off -- so the
  // link goes away instead, on the same "don't offer what the route would refuse" rule those two
  // helpers exist for.
  const hasMidSeason = StateLogic.replenishAvailable(state) || StateLogic.tradeAvailable(state);
  const hasActiveRoster = StateLogic.getLeagueType(state).hasActiveRoster;
  const tabs = TABS.filter(
    (t) =>
      !((t.href === "/draft" || t.href === "/mid-season") && !hasRoster) &&
      !(t.href === "/mid-season" && !hasMidSeason) &&
      !(t.href === "/research" && !hasActiveRoster)
  );

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
    <aside className="sticky top-0 flex h-screen w-[248px] flex-none flex-col overflow-y-auto overflow-x-hidden border-r border-border bg-panel-menu p-[20px_12px]">
      <div className="flex items-center justify-center px-0 pb-[18px] pt-1">
        <Link href="/" className="min-w-0 flex-1">
          <Image src="/sidebar-logo.jpg" alt="Survivor Fantasy Engine" width={855} height={301} className="h-auto w-full" priority />
        </Link>
      </div>

      {mode === "live" && leagueName && <LeagueSwitcher />}

      <nav className="flex flex-col gap-0.5">
        {hasSeason ? (
          tabs.map((tab) => <NavLink key={tab.href} href={tab.href} label={tab.label} active={pathname === tab.href} badge={badgeFor(tab.href)} />)
        ) : (
          <>
            <NavLink href="/dashboard" label="My Leagues" active={pathname === "/dashboard" || pathname === "/"} />
            {/* The one way into the demo season for someone who has no league of their own. It was
                previously only offered as "Switch to demo data" to people who already had one, and
                as "Take a Tour" to people with no account at all -- a new signed-in user could
                reach it from neither. */}
            <button
              className="flex items-center gap-2.5 rounded-[7px] px-3 py-2.5 text-left text-[0.9rem] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={openDemoPicker}
            >
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-current opacity-35" />
              Demo Season
            </button>
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-1.5 border-t border-border px-2.5 pb-1 pt-3">
        {isSuperAdmin && (
          <>
            <Link href="/admin" className="block text-[0.8rem] font-semibold text-primary hover:underline">
              Admin
            </Link>
            <Link href="/reports" className="block text-[0.8rem] font-semibold text-primary hover:underline">
              Reports
            </Link>
            <div className="my-1 h-px bg-border" />
          </>
        )}
        {/* Report an Issue posts as the real signed-in SurvivorDraft user (server-side
            requireAuth) -- gated on real authentication (isAuthenticated/userId), not `mode`,
            since a super-admin with no personal league is genuinely signed in but stays
            mode:'mock' (no league to show live). Using `mode` here blocked that real case. */}
        {isAuthenticated && (
          <>
            <Link href="/account" className="block text-[0.8rem] font-semibold text-primary hover:underline">
              Account settings
            </Link>
            <button className="block text-left text-[0.8rem] font-semibold text-primary hover:underline" onClick={openReportModal}>
              Report an Issue
            </button>
          </>
        )}
        {mode === "mock" ? (
          hasSeason &&
          !isAuthenticated && (
            <button className="block text-left text-[0.8rem] font-semibold text-primary hover:underline" onClick={exitDemo}>
              Sign in
            </button>
          )
        ) : (
          <button className="block text-left text-[0.8rem] font-semibold text-primary hover:underline" onClick={openDemoPicker}>
            Switch to demo data
          </button>
        )}
        <div className="mt-1 flex items-center gap-2 text-[0.8rem] text-muted-foreground">
          <span className="shrink-0">Dark mode</span>
          <ThemePicker className="flex-1" />
        </div>
        {/* Log out belongs with the rest of the account-level rows, not buried on the Dashboard --
            which was the only place it existed, and only for a user with no league. */}
        {isAuthenticated && (
          <button className="block text-left text-[0.8rem] font-semibold text-destructive hover:underline" onClick={logOut}>
            Log out
          </button>
        )}
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: { label: string; urgent: boolean } | null;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-[7px] px-3 py-2.5 text-[0.9rem] font-semibold text-muted-foreground transition-colors",
        active ? "bg-accent text-primary" : "hover:bg-secondary hover:text-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 flex-none rounded-full bg-current", active ? "opacity-100" : "opacity-35")} />
      {label}
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
}
