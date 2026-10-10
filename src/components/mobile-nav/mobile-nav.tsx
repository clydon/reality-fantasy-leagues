"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useClickOutside } from "@/lib/use-click-outside";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useChatStore } from "@/lib/chat-store";
import { useNotificationsStore } from "@/lib/notifications-store";
import StateLogic from "@/lib/game/state-logic.js";
import { myLineupDue } from "@/lib/game/lineup-view";
import { myPickDue } from "@/lib/game/pool-view";
import { logOut } from "@/lib/auth-client";
import { cn } from "cn";
import { midseasonBadge } from "@/lib/game/selectors";
import { LeagueMenu } from "@/components/league-menu";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";
import { ThemePicker } from "@/components/theme-picker";
import {
  OverviewIcon,
  EpisodesIcon,
  TrophyIcon,
  ShuffleIcon,
  DraftIcon,
  MoreIcon,
  ShieldIcon,
  AlertIcon,
  LogoutIcon,
  ChatIcon,
  ResearchIcon,
  LineupIcon,
  PickIcon,
  MoonIcon,
  ChevronDownIcon,
  GearIcon,
  UserIcon,
  SparklesIcon,
} from "@/components/icons";
import { useWhatsNewPreview } from "@/components/whats-new-modal";
import { useMoreSheetRequest } from "@/lib/more-sheet";
import { SwipeTitle } from "@/components/league-swipe";
import { ChevronLeft } from "lucide-react";
import { useShowTerms } from "@/lib/use-show-terms";

// Port of the live app's mobile-only nav chrome (public/index.html's <header class="mobile-topbar">
// / <nav class="mobile-bottombar"> / <div class="mobile-more-sheet">, populated by
// renderMobileNav()/renderMobileMoreSheetBody() in public/app.js) -- a Chess.com-style top bar +
// bottom tab bar, replacing the desktop sidebar below the 880px breakpoint (see globals.css's
// `nav`/`max-nav` custom breakpoint, matching the live app's single @media(max-width:880px) exactly).
//
// The top bar's league-name button is a real switcher now (league-menu.tsx's LeagueMenu, shared with
// the desktop Sidebar version) rather than pure decoration.
// Rules isn't a tab in this POC at all, so the "More" sheet only lists what's actually real: the
// demoted 4th-slot tab, League Settings, Admin+Reports (if applicable), a working Report an Issue
// (real-auth-only -- see the note by its row below), and Log out.
export function MobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const showWhatsNew = useWhatsNewPreview((s) => s.showAll);
  // Opened from elsewhere too (the What's New "Show me" link).
  const moreRequests = useMoreSheetRequest((s) => s.requests);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an outside request to open the sheet
    if (moreRequests > 0) setSheetOpen(true);
  }, [moreRequests]);
  // True for the one render triggered by the back button itself, so closeSheet knows not to also
  // call history.back() (that history entry is already the one being popped).
  const closingViaBack = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  // Back button closes the sheet instead of leaving the page: pushes one history entry while open,
  // and a real back press (popstate) closes it rather than navigating away.
  useEffect(() => {
    if (!sheetOpen) return;
    window.history.pushState({ moreSheet: true }, "");
    const onPopState = () => {
      closingViaBack.current = true;
      setSheetOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [sheetOpen]);

  // The only way to close: pops the history entry pushed above unless the close WAS that pop, so
  // the next real back press doesn't get silently swallowed by a leftover entry.
  function closeSheet() {
    if (closingViaBack.current) {
      closingViaBack.current = false;
    } else if (window.history.state?.moreSheet) {
      window.history.back();
    }
    setSheetOpen(false);
  }

  // Swipe down anywhere on the sheet closes it, like a native one -- as long as the sheet is
  // scrolled to its top, so a downward swipe inside a scrolled list still just scrolls. The slide
  // transition is off while dragging (it made the sheet trail the finger) and back on for the
  // release, so letting go animates. A drag that turns upward hands back to normal scrolling.
  function handleDragStart(e: React.TouchEvent) {
    const sheet = sheetRef.current;
    if (!sheet || sheet.scrollTop > 0) {
      dragStartY.current = null;
      return;
    }
    dragStartY.current = e.touches[0].clientY;
    sheet.style.transition = "none";
  }
  function handleDragMove(e: React.TouchEvent) {
    const sheet = sheetRef.current;
    if (dragStartY.current == null || !sheet) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      sheet.style.transform = `translateY(${delta}px)`;
    } else {
      dragStartY.current = null;
      sheet.style.transform = "";
      sheet.style.transition = "";
    }
  }
  function handleDragEnd(e: React.TouchEvent) {
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transition = "";
      sheet.style.transform = "";
    }
    if (dragStartY.current == null) return;
    const delta = e.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;
    if (delta > 70) closeSheet();
  }
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);
  const leagueMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(leagueMenuRef, leagueMenuOpen, () => setLeagueMenuOpen(false));
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
  const terms = useShowTerms();
  const notifications = useNotificationsStore((s) => s.notifications);

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
  // Active Roster puts Research where Chat would go; chat stays one tap away on the top bar's icon.
  const hasActiveRoster = StateLogic.getLeagueType(state).hasActiveRoster;
  // After the draft Active Roster's slot is the Lineup (docs/PLAN-ux-redesign.md, 1e: slot 4 follows
  // the season phase) -- setting it is the weekly job -- flagged while your lineup has a slot to
  // fill. Research and Mid-Season move to the More sheet.
  const lineupSlot = hasActiveRoster && draftComplete;
  // Eliminator Pool has no draft: its slot is the weekly Pick, flagged while yours is still to make.
  // Chat (which used to take the slot) stays one tap away on the top bar's icon.
  const pickSlot = !!StateLogic.getLeagueType(state).hasWeeklyPicks;
  const fourth = lineupSlot
    ? { href: "/lineup", label: "Lineup", icon: LineupIcon, urgent: myLineupDue(state, myPlayerId) ? true : null }
    : pickSlot
    ? { href: "/pick", label: "Pick", icon: PickIcon, urgent: myPickDue(state, myPlayerId) ? true : null }
    : !hasRoster || (draftComplete && !midSeasonSlot)
      ? hasActiveRoster
        ? { href: "/research", label: "Research", icon: ResearchIcon, urgent: null }
        : { href: "/chat", label: "Chat", icon: ChatIcon, urgent: chatUnread > 0 ? true : null }
      : draftComplete
        ? { ...midSeasonSlot!, urgent: midBadge?.urgent ?? null }
        : { href: "/draft", label: "Draft", icon: DraftIcon, urgent: draftUrgent ? true : null };
  const demoted = !hasRoster ? null : draftComplete ? { href: "/draft", label: "Draft", icon: DraftIcon } : midSeasonSlot;

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

  // The page's own name for the top bar. Overview has none: there the league name is the title.
  const PAGE_TITLES: Record<string, string> = {
    "/episodes": "Episodes",
    "/scoreboard": "Scoreboard",
    "/draft": "Draft",
    "/mid-season": "Mid-Season",
    "/research": "Research",
    "/lineup": "Lineup",
    "/pick": "Pick",
    "/chat": "Chat",
    "/setup": "League Settings",
    "/account": "Account",
    "/dashboard": "My Leagues",
  };
  // A page under another one (an episode's own page, the draft board) names itself and gets a back
  // button to its parent in place of the logo.
  const episodeMatch = /^\/episodes\/(\d+)$/.exec(pathname);
  const boardPage = pathname === "/draft/board";
  // A player's own Scoreboard page is titled with their name.
  const scorePlayer = /^\/scoreboard\/([^/]+)$/.exec(pathname);
  const scorePlayerName = scorePlayer ? (state.players.find((p) => p.id === decodeURIComponent(scorePlayer[1]))?.name ?? "Scoreboard") : null;
  // League Settings' own pages (docs/PLAN-ux-redesign.md, 2b), each a row of /setup.
  const SETUP_PAGES: Record<string, string> = {
    "/setup/players": "Players & invites",
    "/setup/league": "League setup",
    "/setup/lineups": "Lineups",
    "/setup/rules": "Scoring & rules",
    "/setup/rules/edit": "Edit rules",
    "/setup/pickups": "Swaps & pickups",
    "/setup/predictions": "Predictions",
    "/setup/cast": `${terms.Tribes} & ${terms.castaways}`,
    "/setup/linked": "Linked leagues",
    "/setup/backup": "Backup",
  };
  const setupPage = SETUP_PAGES[pathname];
  const parentHref = episodeMatch
    ? "/episodes"
    : scorePlayer
      ? "/scoreboard"
    : boardPage
      ? "/draft"
      : setupPage
        ? pathname === "/setup/rules/edit"
          ? "/setup/rules"
          : "/setup"
        : null;
  const pageTitle =
    PAGE_TITLES[pathname] ??
    (episodeMatch ? `Episode ${episodeMatch[1]}` : boardPage ? "Draft board" : (scorePlayerName ?? setupPage ?? null));

  function go(href: string) {
    // The Demo Season slot has no route of its own -- it opens the picker instead of a page (same
    // as the sidebar's row).
    if (!href) {
      closeSheet();
      openDemoPicker();
      return;
    }
    // Not closeSheet(): its history.back() lands AFTER router.push starts and undoes it, so the tap
    // went nowhere. Replacing the sheet's own history entry with the destination closes the sheet
    // and navigates in one step -- and Back from there still goes to the page under the sheet.
    const onSheetEntry = !!window.history.state?.moreSheet;
    setSheetOpen(false);
    if (onSheetEntry) router.replace(href);
    else router.push(href);
  }

  function toggleLeagueMenu() {
    setLeagueMenuOpen((o) => !o);
  }

  async function handleSelectLeague(id: string) {
    setLeagueMenuOpen(false);
    if (id === leagueId) return;
    await switchLeague(id);
    // Always land on Overview after switching -- see league-switcher.tsx's own note.
    router.push("/");
  }

  function handleLogout() {
    // Not closeSheet(): its history.back() could cancel the full page load logOut starts.
    setSheetOpen(false);
    // Shared with the sidebar and Account settings -- see logOut() in auth-client.ts for why this
    // is a full load to "/" rather than a client-side reset.
    logOut();
  }

  // Port of exitDemoMode() -- same as auth-gate.tsx's handleExitDemo/sidebar.tsx's exitDemo.
  // This row only ever shows when !isAuthenticated (see the MoreRow below), so there's no real
  // session to sign out of -- "Sign in" just means "show me the login screen."
  function handleShowLogin() {
    closeSheet();
    enterMockMode();
    setEntered(false);
  }

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-[55] hidden border-b border-border bg-panel-menu max-nav:block">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          {/* The logo opens the league menu, same as tapping the name. Stopping pointerdown keeps the
              menu's click-outside close from firing first, which would close-then-reopen it. */}
          {parentHref ? (
            <Link
              href={parentHref}
              aria-label="Back"
              className="-my-1.5 -ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-foreground"
            >
              <ChevronLeft className="size-6" strokeWidth={2.2} aria-hidden />
            </Link>
          ) : mode !== "mock" && leagues.length > 0 ? (
            <button
              type="button"
              aria-label="Switch league"
              className="h-[30px] w-[30px] shrink-0 overflow-hidden rounded-lg shadow-sm"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleLeagueMenu}
            >
              <Image src="/icon.png" alt="" width={30} height={30} className="h-full w-full object-cover" />
            </button>
          ) : (
            <Link href="/" className="h-[30px] w-[30px] shrink-0 overflow-hidden rounded-lg shadow-sm">
              <Image src="/icon.png" alt="" width={30} height={30} className="h-full w-full object-cover" />
            </Link>
          )}
          {/* visibility, not display -- demo mode has nothing to switch between, but the button
              still reserves its layout space, exactly like the live app's leagueBtn.style.visibility. */}
          <div ref={leagueMenuRef} className={cn("relative min-w-0 flex-1", mode === "mock" && "invisible")}>
            <button
              className="flex w-full min-w-0 items-center justify-center gap-1 py-0.5 text-foreground"
              onClick={toggleLeagueMenu}
              disabled={leagues.length === 0}
            >
              {pageTitle ? (
                // Direction A: every page names itself. The league name moves up to a small line above
                // the title -- still the switcher, still swipeable.
                <span className="flex min-w-0 flex-col items-center gap-0.5">
                  <span className="flex min-w-0 items-center gap-0.5 text-[12px] font-semibold text-muted-foreground">
                    <SwipeTitle name={mode === "mock" ? "Demo Mode" : (leagueName ?? "")} className="truncate" />
                    <ChevronDownIcon className={cn("h-3.5 w-3.5 shrink-0 transition-transform", leagueMenuOpen && "rotate-180")} />
                  </span>
                  <span className="type-caption truncate text-[22px]">{pageTitle}</span>
                </span>
              ) : (
                <>
                  {/* Balances the arrow on the right, so the name is centred in the bar. */}
                  <span className="w-4 shrink-0" aria-hidden />
                  <SwipeTitle name={mode === "mock" ? "Demo Mode" : (leagueName ?? "")} className="type-caption truncate text-[22px]" />
                  <ChevronDownIcon className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", leagueMenuOpen && "rotate-180")} />
                </>
              )}
            </button>
            {leagueMenuOpen && (
              <div className="absolute left-1/2 top-full z-20 mt-1 max-h-[60vh] w-[min(85vw,320px)] -translate-x-1/2 overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md">
                <LeagueMenu
                  leagues={leagues}
                  leagueId={leagueId}
                  onSelect={handleSelectLeague}
                  onJoinOrCreate={() => {
                    setLeagueMenuOpen(false);
                    router.push("/dashboard");
                  }}
                />
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

      {/* translateZ(0): its own compositing layer. Android Chrome sometimes skipped painting this
          fixed bar until a scroll or an animation forced a repaint -- seen on the season-complete
          Overview, where every castaway photo is faded. */}
      <nav
        data-mobile-tabbar
        className="fixed inset-x-0 bottom-0 z-[55] hidden flex-row border-t border-border bg-panel-menu p-[6px_2px] [transform:translateZ(0)] max-nav:flex"
        style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href || (!!tab.href && tab.href !== "/" && pathname.startsWith(`${tab.href}/`));
          const Icon = tab.icon;
          return (
            <button
              key={tab.href}
              className={cn("relative flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground", active && "text-chyron-line")}
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
          <span className="relative inline-flex">
            <MoreIcon className="h-[21px] w-[21px]" />
            {/* Mid-Season lives in here for Active Roster, so its "your turn" alert does too. */}
            {lineupSlot && midSeasonSlot && midBadge?.urgent && (
              <span className="absolute -right-2 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-destructive text-[0.62rem] font-bold text-white">
                !
              </span>
            )}
          </span>
          <span className="text-[0.63rem] font-semibold">More</span>
        </button>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 transition-opacity",
          sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeSheet}
      />
      <div
        ref={sheetRef}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        // overscroll-contain: a downward pull at the top is the close gesture, not the browser's
        // pull-to-refresh or a scroll of the page behind.
        className={cn(
          "fixed inset-x-0 bottom-0 z-[71] max-h-[75vh] overflow-y-auto overscroll-contain rounded-t-[18px] bg-card p-2 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] shadow-sheet transition-transform",
          sheetOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* touch-action: none -- lets the drag be read as a close gesture instead of the page trying
            to scroll underneath it. */}
        <div
          className="-mt-1 flex justify-center pb-1.5 pt-2.5"
          style={{ touchAction: "none" }}
        >
          <div className="h-1 w-9 rounded-full bg-border" />
        </div>
        {hasSeason && demoted && <MoreRow icon={demoted.icon} label={demoted.label} onClick={() => go(demoted.href)} />}
        {hasSeason && lineupSlot && midSeasonSlot && (
          <MoreRow
            icon={midSeasonSlot.icon}
            label={midBadge ? `Mid-Season · ${midBadge.label}` : "Mid-Season"}
            onClick={() => go(midSeasonSlot.href)}
          />
        )}
        {hasSeason && hasActiveRoster && fourth.href !== "/research" && (
          <MoreRow icon={ResearchIcon} label="Research" onClick={() => go("/research")} />
        )}
        {hasSeason && <MoreRow icon={GearIcon} label="League Settings" onClick={() => go("/setup")} />}
        {!hasSeason && <MoreRow icon={OverviewIcon} label="My Leagues" onClick={() => go("/dashboard")} />}
        {isSuperAdmin && (
          <>
            <div className="my-1.5 h-px bg-border" />
            <div className="px-3 pb-0.5 pt-2 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Admin</div>
            <MoreRow icon={ShieldIcon} label="Admin" onClick={() => go("/admin")} />
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
        {/* Not a MoreRow: it's a setting to change in place, not somewhere to go, so the sheet stays open. */}
        <div className="flex items-center gap-3 px-3 py-2 text-[0.92rem]">
          <MoonIcon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">Dark mode</span>
          <ThemePicker className="w-[172px] max-w-[55%] shrink-0" />
        </div>
        {/* Reachable even with a real season loaded now, not just when leagueless -- picking one
            replaces the view with demo data the same way Sidebar's "Switch to demo data" does. */}
        <MoreRow icon={EpisodesIcon} label="Demo Season" onClick={() => go("")} />
        {/* Every What's New release, any time -- not just the once it popped up. */}
        {isAuthenticated && (
          <MoreRow
            icon={SparklesIcon}
            label="What's new"
            onClick={() => {
              closeSheet();
              showWhatsNew();
            }}
          />
        )}
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
