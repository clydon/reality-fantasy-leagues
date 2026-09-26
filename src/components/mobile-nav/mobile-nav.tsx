"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useChatStore } from "@/lib/chat-store";
import { useNotificationsStore } from "@/lib/notifications-store";
import StateLogic from "@/lib/game/state-logic.js";
import { logOut } from "@/lib/auth-client";
import { cn } from "cn";
import { midseasonBadge } from "@/lib/game/selectors";
import { useLeagueTypeBadges } from "@/components/league-switcher";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";
import { Badge } from "@/components/ui/badge";
import {
  OverviewIcon,
  EpisodesIcon,
  TrophyIcon,
  ShuffleIcon,
  DraftIcon,
  MoreIcon,
  ShieldIcon,
  ClipboardIcon,
  AlertIcon,
  LogoutIcon,
  ChatIcon,
  ChevronDownIcon,
  GearIcon,
  UserIcon,
} from "@/components/icons";

// Port of the live app's mobile-only nav chrome (public/index.html's <header class="mobile-topbar">
// / <nav class="mobile-bottombar"> / <div class="mobile-more-sheet">, populated by
// renderMobileNav()/renderMobileMoreSheetBody() in public/app.js) -- a Chess.com-style top bar +
// bottom tab bar, replacing the desktop sidebar below the 880px breakpoint (see globals.css's
// `nav`/`max-nav` custom breakpoint, matching the live app's single @media(max-width:880px) exactly).
//
// The top bar's league-name button is a real switcher now (see league-switcher.tsx's
// useLeagueTypeBadges, shared with the desktop Sidebar version) rather than pure decoration.
// Rules isn't a tab in this POC at all, so the "More" sheet only lists what's actually real: the
// demoted 4th-slot tab, League Settings, Admin+Reports (if applicable), a working Report an Issue
// (real-auth-only -- see the note by its row below), and Log out.
export function MobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const state = useLeagueStore((s) => s.state);
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const leagues = useLeagueStore((s) => s.leagues);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const isSuperAdmin = useIsSuperAdmin();
  const isAuthenticated = useIsAuthenticated();
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const isPreviewingDemo = useIsPreviewingDemo();
  const openReportModal = useReportModalStore((s) => s.openModal);
  const openDemoPicker = useDemoSeasonPickerStore((s) => s.openPicker);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const chatUnread = useChatStore((s) => s.unreadCount);
  const notifications = useNotificationsStore((s) => s.notifications);
  const { types: leagueTypes, showNames: leagueShowNames, resolve: resolveLeagueTypes } = useLeagueTypeBadges(leagues);

  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);
  const hasRoster = StateLogic.getLeagueType(state).hasRoster;
  // Same gate the desktop sidebar uses: Mid-Season only exists when the league type supports
  // replenish/trade AND the commissioner turned one on. Without it there's no round to promote
  // into the 4th slot or demote into the More sheet -- see sidebar.tsx's note.
  const hasMidSeason = StateLogic.replenishAvailable(state) || StateLogic.tradeAvailable(state);
  // Whether there's a season to browse at all -- a real league, or the demo one someone stepped
  // into deliberately. Mirrors sidebar.tsx's `hasSeason`, and for the same reason: a signed-in user
  // with no league would otherwise get a tab bar of views onto demo data they never asked for.
  const hasSeason = mode === "live" || isPreviewingDemo;
  // Port of computeMobileFourthTab() (public/app.js): the 4th bottom-bar slot's badge is always
  // just "!" (no room for "Your Turn"/"Active" text at this size) -- red when it's genuinely your
  // turn/pick, muted when a round is merely active. Draft's badge also folds in the same
  // "it's your turn to draft" signal the Notifications banner uses (notifications tagged '/draft').
  // Not in the original (predates this repo's second league type): a league type with no roster
  // at all (pickem) has neither Draft nor Mid-Season to show here, so the slot promotes Chat
  // instead (already reachable via the header icon too, but worth the always-visible bottom-bar
  // spot given it's now this league type's only "other players' activity" surface) and there's
  // nothing to demote into the More sheet.
  const draftUrgent = !!(turn && !turn.isComplete && myPlayerId && turn.playerId === myPlayerId) || notifications.some((n) => n.tab === "/draft");
  const midBadge = midseasonBadge(state, myPlayerId);
  const midSeasonSlot = hasMidSeason ? { href: "/mid-season", label: "Mid-Season", icon: ShuffleIcon } : null;
  const fourth =
    !hasRoster || (draftComplete && !midSeasonSlot)
      ? { href: "/chat", label: "Chat", icon: ChatIcon, urgent: chatUnread > 0 ? true : null }
      : draftComplete
        ? { ...midSeasonSlot!, urgent: midBadge?.urgent ?? null }
        : { href: "/draft", label: "Draft", icon: DraftIcon, urgent: draftUrgent ? true : null };
  const demoted = !hasRoster ? null : draftComplete ? { href: "/draft", label: "Draft Results", icon: DraftIcon } : midSeasonSlot;

  const leagueTabs: { href: string; label: string; icon: typeof OverviewIcon; urgent?: boolean | null }[] = [
    { href: "/", label: "Overview", icon: OverviewIcon },
    { href: "/episodes", label: "Episodes", icon: EpisodesIcon },
    { href: "/scoreboard", label: "Scoreboard", icon: TrophyIcon },
    fourth,
  ];
  // No league and not previewing: the only two places worth going are the join/create screen and
  // the demo season (the latter is a state change, not a route -- hence the null href below).
  const tabs = hasSeason
    ? leagueTabs
    : [
        { href: "/dashboard", label: "My Leagues", icon: OverviewIcon },
        { href: "", label: "Demo Season", icon: EpisodesIcon },
      ];

  function go(href: string) {
    setSheetOpen(false);
    // The Demo Season slot has no route of its own -- it opens the picker instead of a page (same
    // as the sidebar's row).
    if (!href) {
      openDemoPicker();
      return;
    }
    router.push(href);
  }

  function toggleLeagueMenu() {
    setLeagueMenuOpen((o) => !o);
    resolveLeagueTypes();
  }

  async function handleSelectLeague(id: string) {
    setLeagueMenuOpen(false);
    if (id === leagueId) return;
    await switchLeague(id);
    // Always land on Overview after switching -- see league-switcher.tsx's own note.
    router.push("/");
  }

  function handleLogout() {
    setSheetOpen(false);
    // Shared with the sidebar and Account settings -- see logOut() in auth-client.ts for why this
    // is a full load to "/" rather than a client-side reset.
    logOut();
  }

  // Port of exitDemoMode() -- same as auth-gate.tsx's handleExitDemo/sidebar.tsx's exitDemo.
  // This row only ever shows when !isAuthenticated (see the MoreRow below), so there's no real
  // session to sign out of -- "Sign in" just means "show me the login screen."
  function handleShowLogin() {
    setSheetOpen(false);
    enterMockMode();
    setEntered(false);
  }

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-[55] hidden border-b border-border bg-panel-menu max-nav:block">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <Link href="/" className="h-[30px] w-[30px] shrink-0 overflow-hidden rounded-lg shadow-sm">
            <Image src="/icon.png" alt="" width={30} height={30} className="h-full w-full object-cover" />
          </Link>
          {/* visibility, not display -- demo mode has nothing to switch between, but the button
              still reserves its layout space, exactly like the live app's leagueBtn.style.visibility. */}
          <div className={cn("relative min-w-0 flex-1", mode === "mock" && "invisible")}>
            <button
              className="flex w-full min-w-0 items-center gap-1 py-0.5 text-foreground"
              onClick={toggleLeagueMenu}
              disabled={leagues.length === 0}
            >
              <span className="truncate text-[0.95rem] font-bold">{mode === "mock" ? "Demo Mode" : leagueName}</span>
              <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", leagueMenuOpen && "rotate-180")} />
            </button>
            {leagueMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 max-h-[60vh] w-[min(85vw,320px)] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md">
                {leagues.map((l) => (
                  <button
                    key={l.id}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left hover:bg-secondary",
                      l.id === leagueId && "bg-secondary"
                    )}
                    onClick={() => handleSelectLeague(l.id)}
                  >
                    <span className="flex w-full items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.name}</span>
                      {leagueShowNames[l.id] && (
                        <span className="shrink-0 text-xs text-muted-foreground">{leagueShowNames[l.id]}</span>
                      )}
                    </span>
                    {(leagueTypes[l.id] || l.role === "commissioner") && (
                      <span className="flex items-center gap-1">
                        {leagueTypes[l.id] && (
                          <Badge variant="secondary" className="shrink-0 text-[0.65rem]">
                            {leagueTypes[l.id]}
                          </Badge>
                        )}
                        {l.role === "commissioner" && (
                          <span className="text-xs text-amber-600">Commissioner</span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  className="mt-1 flex w-full items-center rounded-md border-t border-border px-2.5 pb-1 pt-2 text-left text-sm font-semibold text-primary hover:bg-secondary"
                  onClick={() => {
                    setLeagueMenuOpen(false);
                    router.push("/dashboard");
                  }}
                >
                  + Join or create a league
                </button>
              </div>
            )}
          </div>
          <Link
            href="/chat"
            className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-foreground"
            aria-label="Chat"
          >
            <ChatIcon className="h-[19px] w-[19px]" />
            {chatUnread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-[3px] text-[0.6rem] font-bold text-white ring-2 ring-panel-menu">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </Link>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-[55] hidden flex-row border-t border-border bg-panel-menu p-[6px_2px] max-nav:flex"
        style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <button
              key={tab.href}
              className={cn("relative flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground", active && "text-primary")}
              onClick={() => go(tab.href)}
            >
              <span className="relative inline-flex">
                <Icon className="h-[21px] w-[21px]" />
                {tab.urgent != null && (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[0.62rem] font-bold text-white",
                      tab.urgent ? "bg-destructive" : "bg-accent-2"
                    )}
                  >
                    !
                  </span>
                )}
              </span>
              <span className="text-[0.63rem] font-semibold">{tab.label}</span>
            </button>
          );
        })}
        <button
          className="flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground"
          onClick={() => setSheetOpen(true)}
        >
          <MoreIcon className="h-[21px] w-[21px]" />
          <span className="text-[0.63rem] font-semibold">More</span>
        </button>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 transition-opacity",
          sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setSheetOpen(false)}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[71] max-h-[75vh] overflow-y-auto rounded-t-[18px] bg-card p-2 pb-3.5 shadow-[0_-8px_24px_rgba(20,18,14,.2)] transition-transform",
          sheetOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-auto mb-2.5 mt-1.5 h-1 w-9 rounded-full bg-border" />
        {hasSeason && demoted && <MoreRow icon={demoted.icon} label={demoted.label} onClick={() => go(demoted.href)} />}
        {hasSeason && <MoreRow icon={GearIcon} label="League Settings" onClick={() => go("/setup")} />}
        {!hasSeason && <MoreRow icon={OverviewIcon} label="My Leagues" onClick={() => go("/dashboard")} />}
        {isSuperAdmin && (
          <>
            <div className="my-1.5 h-px bg-border" />
            <div className="px-3 pb-0.5 pt-2 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Admin</div>
            <MoreRow icon={ShieldIcon} label="Admin" onClick={() => go("/admin")} />
            <MoreRow icon={ClipboardIcon} label="Reports" onClick={() => go("/reports")} />
          </>
        )}
        <div className="my-1.5 h-px bg-border" />
        {/* Report an Issue posts as the real signed-in SurvivorDraft user (server-side
            requireAuth) -- gated on real authentication, not `mode` (a super-admin with no
            personal league is genuinely signed in but stays mode:'mock' -- see store.ts's
            useIsAuthenticated for why that distinction matters). */}
        {isAuthenticated && (
          <>
            <MoreRow icon={UserIcon} label="Account settings" onClick={() => go("/account")} />
            <MoreRow
              icon={AlertIcon}
              label="Report an Issue"
              onClick={() => {
                setSheetOpen(false);
                openReportModal();
              }}
            />
            <div className="my-1.5 h-px bg-border" />
          </>
        )}
        {/* Reachable even with a real season loaded now, not just when leagueless -- picking one
            replaces the view with demo data the same way Sidebar's "Switch to demo data" does. */}
        <MoreRow icon={EpisodesIcon} label="Demo Season" onClick={() => go("")} />
        <div className="my-1.5 h-px bg-border" />
        <MoreRow
          icon={LogoutIcon}
          label={isAuthenticated ? "Log out" : "Sign in"}
          onClick={isAuthenticated ? handleLogout : handleShowLogin}
          danger
        />
      </div>
    </>
  );
}

function MoreRow({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-[9px] px-3 py-3 text-left text-[0.92rem] hover:bg-secondary",
        danger ? "text-destructive" : "text-foreground",
        disabled && "opacity-50"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
      {label}
    </button>
  );
}
