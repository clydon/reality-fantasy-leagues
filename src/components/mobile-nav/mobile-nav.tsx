"use client";

import { useEffect, useRef, useState } from "react";
import { ReplayBug, useLateJoin } from "@/components/late-join/replay-bug";
import Link from "next/link";
import { useClickOutside } from "@/lib/use-click-outside";
import { usePathname, useRouter } from "next/navigation";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated, useIsPreviewingDemo, useCanManage } from "@/lib/store";
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
import { useWhatsNewCount, useWhatsNewPreview } from "@/components/whats-new-modal";
import { useMoreSheetRequest } from "@/lib/more-sheet";
import { useTourRunning, useTourStep, useTourStore } from "@/lib/tour/tour-store";
import { SwipeTitle } from "@/components/league-swipe";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { pageTitle as pageTitleFor, useBackTarget } from "@/lib/nav-trail";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { commissionerItems } from "@/lib/game/commissioner-items";
import { useHeaderAction } from "@/lib/header-action-store";
import { useShowCatalog, useShowTerms } from "@/lib/use-show-terms";
import { publicMediaSrc } from "@/lib/game/selectors";
import { artStyleVars } from "@/lib/show-art-style";

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
  const lateJoin = useLateJoin();
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
  const headerAction = useHeaderAction((s) => s.action);
  const terms = useShowTerms();
  const notifications = useNotificationsStore((s) => s.notifications);
  const canManage = useCanManage();
  // The guided tour holds back the tab bar's urgency marks until their step (docs/PLAN-guided-tour.md):
  // with the host on, only a tab the current step points at keeps its "!".
  const tourRunning = useTourRunning();
  const tourStep = useTourStep();
  const startTour = useTourStore((s) => s.start);
  const touring = useLeagueStore((s) => s.touring);
  const tourAllows = (target: string) => !tourRunning || !!tourStep?.nav?.targets.includes(target) || !!tourStep?.targets.includes(target);
  const whatsNewCount = useWhatsNewCount();
  const joinCode = leagues.find((l) => l.id === leagueId)?.join_code;
  const activeSeats = state.players.filter((p) => !p.disabled).length;
  // League Settings' rows carry the commissioner's to-dos as dots; this one says there's one inside.
  const commishWaiting = canManage && commissionerItems(state).length > 0;
  // The league's show art for Overview's header (catalog shows.art_url), unless it failed to load.
  const { data: catalog } = useShowCatalog();
  const [artFailed, setArtFailed] = useState<string | null>(null);
  const leagueShow = catalog?.shows.find((sh) => sh.slug === state.settings.showId);
  const showArt = publicMediaSrc(leagueShow?.art_url);
  const artSrc = pathname === "/" && mode === "live" && showArt && showArt !== artFailed ? showArt : null;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!artSrc) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [artSrc]);

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
  // Active Roster gets a fifth slot, Research (who's scoring), at every phase: it's where you decide
  // who to start and who to pick up, so it isn't buried in More. Chat stays one tap away on the top
  // bar's icon.
  const hasActiveRoster = StateLogic.getLeagueType(state).hasActiveRoster;
  // After the draft Active Roster's slot is the Lineup (docs/PLAN-ux-redesign.md, 1e: slot 4 follows
  // the season phase) -- setting it is the weekly job -- flagged while your lineup has a slot to
  // fill. Mid-Season moves to the More sheet.
  const lineupSlot = hasActiveRoster && draftComplete;
  // Eliminator Pool has no draft: its slot is the weekly Pick, flagged while yours is still to make.
  // Chat (which used to take the slot) stays one tap away on the top bar's icon.
  const pickSlot = !!StateLogic.getLeagueType(state).hasWeeklyPicks;
  const fourth = lineupSlot
    ? { href: "/lineup", label: "Lineup", icon: LineupIcon, urgent: myLineupDue(state, myPlayerId) ? true : null }
    : pickSlot
    ? { href: "/pick", label: "Pick", icon: PickIcon, urgent: myPickDue(state, myPlayerId) ? true : null }
    : !hasRoster || (draftComplete && !midSeasonSlot)
      ? { href: "/chat", label: "Chat", icon: ChatIcon, urgent: chatUnread > 0 ? true : null }
      : draftComplete
        ? { ...midSeasonSlot!, urgent: midBadge?.urgent ?? null }
        : { href: "/draft", label: "Draft", icon: DraftIcon, urgent: draftUrgent ? true : null };
  const demoted = !hasRoster ? null : draftComplete ? { href: "/draft", label: "Draft", icon: DraftIcon } : midSeasonSlot;

  const leagueTabs: { href: string; label: string; icon: typeof OverviewIcon; urgent?: boolean | null }[] = [
    { href: "/", label: "Overview", icon: OverviewIcon },
    { href: "/episodes", label: "Episodes", icon: EpisodesIcon },
    { href: "/scoreboard", label: "Scoreboard", icon: TrophyIcon },
    fourth,
    ...(hasActiveRoster ? [{ href: "/research", label: "Research", icon: ResearchIcon }] : []),
  ];
  // No league and not previewing: the only two places worth going are the join/create screen and
  // the demo season (the latter is a state change, not a route -- hence the null href below).
  const tabs = hasSeason
    ? leagueTabs
    : [
        { href: "/dashboard", label: "My Leagues", icon: OverviewIcon },
        { href: "", label: "Demo Season", icon: EpisodesIcon },
      ];

  // The page's own name for the top bar. Overview has none: there the league name is the title. A
  // page under another gets a back that names where it goes (lib/nav-trail.ts: the page you came
  // from, else its parent).
  const pageTitle = pageTitleFor(pathname, {
    playerName: (id) => state.players.find((p) => p.id === id)?.name,
    tribes: terms.Tribes,
    castaways: terms.castaways,
  });
  const back = useBackTarget();

  function takeTour() {
    setSheetOpen(false);
    startTour();
    router.push("/");
  }

  // The commissioner's tour starts by creating its league.
  function takeCommissionerTour() {
    setSheetOpen(false);
    startTour("commissioner");
    router.push("/new-league");
  }

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
      {/* Overview only: the show's key art, faded, behind the header and the opener plate
          (docs/PLAN-ux-declutter.md, decision 8; the canvas's "A2 · Header art"). A texture, not a
          picture by default: greyscale, low strength, dimmed toward the name and gone before the first
          section (.show-art in globals.css); an admin can give a show more color, strength or a
          different crop (shows.art_style). It sits at the top of the page under everything, so it
          scrolls away with it. A show without art gets the plain ground. */}
      {artSrc && (
        <div aria-hidden className="show-art pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[170px] max-nav:block" style={artStyleVars(leagueShow?.art_style)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
          <img src={artSrc} alt="" onError={() => setArtFailed(artSrc)} />
        </div>
      )}
      <header
        className={cn(
          "sticky top-[env(safe-area-inset-top,0px)] z-[55] hidden border-b transition-colors max-nav:block",
          // Over the art the bar is clear until the page scrolls under it.
          artSrc && !scrolled ? "border-transparent bg-transparent" : "border-border bg-panel-menu",
        )}
      >
        <div
          className={cn(
            "py-2.5",
            // A titled page is three columns, so the title stays centred whatever the back says.
            pageTitle ? "grid grid-cols-[minmax(34px,1fr)_auto_minmax(34px,1fr)] items-center gap-2 px-3.5" : "flex items-center gap-2.5 pl-4 pr-3.5",
          )}
        >
          {/* No logo (docs/PLAN-ux-declutter.md). A page under another backs up to where you came from,
              named; any other titled page leaves the left column empty. */}
          {pageTitle && <div className="flex min-w-0 items-center">{back && <BackLink target={back} variant="header" />}</div>}
          <div ref={leagueMenuRef} className={cn("relative min-w-0", !pageTitle && "flex-1")}>
            <button
              className={cn("flex w-full min-w-0 items-center gap-1 py-0.5 text-foreground", pageTitle ? "justify-center" : "justify-start")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleLeagueMenu}
              disabled={mode === "mock" || leagues.length === 0}
              aria-label={pageTitle ? undefined : "Switch league"}
              data-tour="header-league"
            >
              {pageTitle ? (
                // Direction A: every page names itself. The league name moves up to a small line above
                // the title -- still the switcher, still swipeable.
                <span className="flex min-w-0 flex-col items-center gap-0.5">
                  <span className="flex min-w-0 items-center gap-0.5 text-[12px] font-semibold text-muted-foreground">
                    <SwipeTitle name={mode === "mock" ? (leagueName ?? "Demo Mode") : (leagueName ?? "")} className="truncate" />
                    {mode !== "mock" && <ChevronDownIcon className={cn("h-3.5 w-3.5 shrink-0 transition-transform", leagueMenuOpen && "rotate-180")} />}
                  </span>
                  <span className="type-caption truncate text-[22px]">{pageTitle}</span>
                </span>
              ) : (
                // Overview: the league name is the page's title, left-aligned like the canvas's A2 pages.
                <>
                  <SwipeTitle name={mode === "mock" ? (leagueName ?? "Demo Mode") : (leagueName ?? "")} className="type-caption truncate text-[26px] leading-none" align="start" />
                  {mode !== "mock" && (
                    <ChevronDownIcon className={cn("h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform", leagueMenuOpen && "rotate-180")} />
                  )}
                </>
              )}
            </button>
            {leagueMenuOpen && (
              <div
                className={cn(
                  "absolute top-full z-20 mt-1 max-h-[60vh] w-[min(85vw,320px)] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md",
                  pageTitle ? "left-1/2 -translate-x-1/2" : "left-0",
                )}
              >
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
          {headerAction ? (
            // A page's own actions (header-action-store.ts), in chat's place while that page is open.
            <button
              type="button"
              aria-label={headerAction.label}
              onClick={headerAction.onClick}
              className="-my-1.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center justify-self-end text-foreground"
            >
              <MoreHorizontal className="size-[22px]" strokeWidth={2.2} aria-hidden />
            </button>
          ) : lateJoin ? (
            // A late joiner has no chat yet (GhostLogic): their REPLAY / OFF AIR bug stands in its place.
            <ReplayBug />
          ) : (
            <Link
              href="/chat"
              className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center justify-self-end rounded-full text-foreground"
              aria-label="Chat"
              data-tour="header-chat"
            >
              <ChatIcon className="h-[19px] w-[19px]" />
              {chatUnread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-[3px] text-[0.6rem] font-bold text-white ring-2 ring-panel-menu">
                  {chatUnread > 9 ? "9+" : chatUnread}
                </span>
              )}
            </Link>
          )}
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
          const active =
            pathname === tab.href ||
            (!!tab.href && tab.href !== "/" && pathname.startsWith(`${tab.href}/`)) ||
            // The Cast page lives under Episodes, where it's linked from.
            (tab.href === "/episodes" && pathname === "/cast");
          const Icon = tab.icon;
          const tourId = `tab-${tab.label.toLowerCase()}`;
          const urgent = tourAllows(tourId) ? tab.urgent : null;
          return (
            <button
              key={tab.href}
              data-tour={tourId}
              className={cn("relative flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground", active && "text-chyron-line")}
              onClick={() => go(tab.href)}
            >
              <span className="relative inline-flex">
                <Icon className="h-[21px] w-[21px]" />
                {urgent != null && (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[0.62rem] font-bold text-white",
                      urgent ? "bg-destructive" : "bg-accent-2"
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
          data-tour="tab-more"
        >
          <span className="relative inline-flex">
            <MoreIcon className="h-[21px] w-[21px]" />
            {/* Mid-Season lives in here for Active Roster, so its "your turn" alert does too. */}
            {lineupSlot && midSeasonSlot && midBadge?.urgent && tourAllows("tab-more") && (
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
          "fixed inset-x-0 bottom-0 z-[71] max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-[14px] bg-card px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-2 shadow-sheet transition-transform",
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
        {/* M1 (docs/PLAN-ux-declutter.md): this league first, under a plate that also switches league;
            then you; then Admin; Log out last in red. */}
        {hasSeason && (
          <CaptionPlate
            size="sm"
            tone="quiet"
            tag={state.settings.wikiSeason != null ? `S${state.settings.wikiSeason}` : "League"}
            title={mode === "live" || touring ? (leagueName ?? "") : "Demo season"}
            subtitle={[
              [terms.showName, state.settings.wikiSeason].filter((x) => x != null && x !== "").join(" "),
              StateLogic.getLeagueType(state).name,
              `${activeSeats} player${activeSeats === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {...(mode === "live" && leagues.length > 0
              ? {
                  action: "Switch",
                  onClick: () => {
                    closeSheet();
                    setLeagueMenuOpen(true);
                  },
                }
              : {})}
          />
        )}
        <div className="mt-2.5 flex flex-col">
          {hasSeason && demoted && (
            <MoreRow
              icon={demoted.icon}
              label={demoted.label}
              value={demoted.href === "/draft" ? "Done" : midBadge?.label}
              urgent={demoted.href !== "/draft" && !!midBadge?.urgent}
              onClick={() => go(demoted.href)}
            />
          )}
          {hasSeason && lineupSlot && midSeasonSlot && (
            <MoreRow
              icon={midSeasonSlot.icon}
              label="Mid-Season"
              value={midBadge?.label}
              urgent={!!midBadge?.urgent}
              onClick={() => go(midSeasonSlot.href)}
              tour="more-midseason"
            />
          )}
          {hasSeason && (
            <MoreRow icon={GearIcon} label="League Settings" value={joinCode ? `Code ${joinCode}` : undefined} dot={commishWaiting} onClick={() => go("/setup")} />
          )}
          {!hasSeason && <MoreRow icon={OverviewIcon} label="My Leagues" onClick={() => go("/dashboard")} />}
        </div>

        <div className="type-caption px-0.5 pb-1.5 pt-3.5 text-[14px] tracking-[0.04em] text-muted-foreground">You</div>
        <div className="flex flex-col">
          {/* Report an issue posts as the real signed-in user (server-side requireAuth) -- gated on real
              authentication, not `mode` (a super-admin with no personal league is genuinely signed in
              but stays mode:'mock' -- see store.ts's useIsAuthenticated). */}
          {isAuthenticated ? (
            <>
              <MoreRow icon={UserIcon} label="Account" value="Appearance, notifications" onClick={() => go("/account")} />
              <MoreRow
                icon={SparklesIcon}
                label="What's new"
                value={whatsNewCount > 0 ? `${whatsNewCount} new` : undefined}
                onClick={() => {
                  closeSheet();
                  showWhatsNew();
                }}
              />
              <MoreRow
                icon={AlertIcon}
                label="Report an issue"
                onClick={() => {
                  setSheetOpen(false);
                  openReportModal();
                }}
              />
            </>
          ) : (
            // No account to keep it on: the theme stays here while touring. Not a MoreRow -- it's a
            // setting changed in place, so the sheet stays open.
            <div className="flex min-h-[50px] items-center gap-3.5 border-t border-border text-base font-semibold">
              <MoonIcon className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Appearance</span>
              <ThemePicker className="w-[172px] max-w-[55%] shrink-0" />
            </div>
          )}
          {/* Picking one replaces the view with demo data, the same as the sidebar's Demo season. */}
          <MoreRow icon={SparklesIcon} label={touring ? "Replay the tour" : "Take the tour"} value="3 min" onClick={takeTour} />
          <MoreRow icon={SparklesIcon} label="Commissioner tour" value="2 min" onClick={takeCommissionerTour} />
          <MoreRow icon={EpisodesIcon} label="Demo season" onClick={() => go("")} />
          {isSuperAdmin && <MoreRow icon={ShieldIcon} label="Admin" value="Shows, users, results" onClick={() => go("/admin")} />}
          <MoreRow
            icon={LogoutIcon}
            label={isAuthenticated ? "Log out" : "Sign in"}
            onClick={isAuthenticated ? handleLogout : handleShowLogin}
            danger={isAuthenticated}
          />
        </div>
      </div>
    </>
  );
}

function MoreRow({
  icon: Icon,
  label,
  value,
  urgent,
  dot,
  onClick,
  danger,
  tour,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Its current value, muted on the right ("Done", "Code HXG27Y", "2 new"). */
  value?: string;
  /** The tab bar's "needs you" mark. */
  urgent?: boolean;
  /** A chyron dot: something here needs the commissioner. */
  dot?: boolean;
  onClick: () => void;
  danger?: boolean;
  /** Its `data-tour` name, when the guided tour points at it. */
  tour?: string;
}) {
  return (
    <button
      data-tour={tour}
      className={cn(
        "flex min-h-[50px] w-full items-center gap-3.5 border-t border-border text-left text-base font-semibold outline-none hover:bg-accent/40 focus-visible:bg-accent",
        danger ? "text-destructive" : "text-foreground",
      )}
      onClick={onClick}
    >
      <Icon className={cn("size-5 shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {urgent && (
        <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold text-white">!</span>
      )}
      {dot && <span className="size-2 shrink-0 rounded-full bg-chyron-line" aria-label="Needs attention" />}
      {value && <span className="shrink-0 text-[13px] font-medium text-muted-foreground">{value}</span>}
      {!danger && <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />}
    </button>
  );
}

